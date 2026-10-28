package com.kosign.vbiz.platform.service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.SecureTokens;
import com.kosign.vbiz.platform.domain.PlatformOrg;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSelector;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;

import lombok.extern.slf4j.Slf4j;

/**
 * Checks a platform ID token: RS256 signature against the platform's JWKS (cached by {@code kid},
 * fetched again for an unknown one), {@code iss} = {@code VBIZ_PLATFORM_URL}, {@code aud} = the
 * client id, {@code exp} with at most 60 s of clock skew, and the {@code nonce} of this sign-in.
 */
@Slf4j
@Component
public class PlatformTokenVerifier {

    static final int MAX_CLOCK_SKEW_SECONDS = 60;

    private final PlatformProperties props;
    private final PlatformClient client;
    private final Clock clock;
    private volatile JWKSet keys;
    private volatile Instant keysFetchedAt = Instant.EPOCH;

    public PlatformTokenVerifier(PlatformProperties props, PlatformClient client, Clock clock) {
        this.props = props;
        this.client = client;
        this.clock = clock;
    }

    /** The verified identity from the token. */
    public record PlatformIdentity(String subject, String email, String name, String locale, List<PlatformOrg> orgs) {
    }

    /** {@code INVALID_TOKEN} for any token that fails a check; {@code nonceHash} is the SHA-256 hex of the nonce sent. */
    public PlatformIdentity verify(String idToken, String nonceHash) {
        JWTClaimsSet claims;
        try {
            claims = processor().process(idToken, null);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("[PLATFORM] ID token refused: {}", ex.getMessage());
            throw invalid();
        }
        try {
            String nonce = claims.getStringClaim("nonce");
            if (nonce == null || !SecureTokens.equalsConstantTime(SecureTokens.sha256Hex(nonce), nonceHash)) {
                log.warn("[PLATFORM] ID token refused: nonce does not match this sign-in");
                throw invalid();
            }
            String sub = claims.getSubject();
            if (sub == null || sub.isBlank() || sub.length() > 255) {
                throw invalid();
            }
            return new PlatformIdentity(sub, claims.getStringClaim("email"), claims.getStringClaim("name"),
                    claims.getStringClaim("locale"), orgs(claims.getClaim("orgs")));
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("[PLATFORM] ID token refused: {}", ex.getMessage());
            throw invalid();
        }
    }

    private DefaultJWTProcessor<SecurityContext> processor() {
        DefaultJWTProcessor<SecurityContext> p = new DefaultJWTProcessor<>();
        p.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, keySource()));
        DefaultJWTClaimsVerifier<SecurityContext> claims = new DefaultJWTClaimsVerifier<>(
                props.clientId(),
                new JWTClaimsSet.Builder().issuer(props.url()).build(),
                new HashSet<>(Set.of("sub", "iss", "aud", "exp", "iat", "nonce"))) {
            @Override
            protected java.util.Date currentTime() {
                return java.util.Date.from(clock.instant());
            }
        };
        claims.setMaxClockSkew(MAX_CLOCK_SKEW_SECONDS);
        p.setJWTClaimsSetVerifier(claims);
        return p;
    }

    /** The cached key set; fetched again (at most every {@code jwks-refetch-interval}) when no key matches. */
    private JWKSource<SecurityContext> keySource() {
        return (JWKSelector selector, SecurityContext ctx) -> {
            JWKSet cached = keys;
            if (cached != null) {
                List<JWK> found = selector.select(cached);
                if (!found.isEmpty()
                        || clock.instant().isBefore(keysFetchedAt.plus(props.jwksRefetchInterval()))) {
                    return found;
                }
            }
            synchronized (this) {
                JWKSet fresh = client.jwks();
                keys = fresh;
                keysFetchedAt = clock.instant();
                return selector.select(fresh);
            }
        };
    }

    @SuppressWarnings("unchecked")
    private static List<PlatformOrg> orgs(Object claim) {
        List<PlatformOrg> out = new ArrayList<>();
        if (!(claim instanceof List<?> list)) {
            return out;
        }
        for (Object o : list) {
            if (o instanceof Map<?, ?> m) {
                Map<String, Object> org = (Map<String, Object>) m;
                Object id = org.get("id");
                if (id == null) {
                    continue;
                }
                try {
                    java.util.UUID.fromString(id.toString());
                } catch (IllegalArgumentException e) {
                    continue;
                }
                out.add(new PlatformOrg(id.toString(), str(org.get("slug")), str(org.get("name")),
                        str(org.get("role"))));
            }
        }
        return out;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static BusinessException invalid() {
        return BusinessException.withDetail(StatusCode.INVALID_TOKEN, "code", "The platform sign-in could not be verified");
    }
}
