package com.kosign.vbiz.auth.service;

import java.net.MalformedURLException;
import java.net.URI;
import java.util.HashSet;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;

import lombok.extern.slf4j.Slf4j;

/**
 * Verifies a Google Sign-In ID token against Google's published keys (RS256): signature,
 * expiry, issuer, audience = {@code vbiz.google.client-id}, and a verified email.
 */
@Slf4j
@Component
public class GoogleTokenVerifier {

    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    private final GoogleProperties props;
    private volatile DefaultJWTProcessor<SecurityContext> processor;

    public GoogleTokenVerifier(GoogleProperties props) {
        this.props = props;
    }

    /** The verified Google identity. */
    public record GoogleIdentity(String subject, String email, String name, String picture) {
    }

    public boolean configured() {
        return props.configured();
    }

    /** {@code NOT_CONFIGURED} without a client id; {@code INVALID_TOKEN} for any bad token. */
    public GoogleIdentity verify(String idToken) {
        if (!props.configured()) {
            throw new BusinessException(StatusCode.NOT_CONFIGURED);
        }
        try {
            JWTClaimsSet claims = processor().process(idToken, null);
            if (!ISSUERS.contains(claims.getIssuer())) {
                throw invalid();
            }
            Boolean verified = claims.getBooleanClaim("email_verified");
            String email = claims.getStringClaim("email");
            if (email == null || !Boolean.TRUE.equals(verified)) {
                throw invalid();
            }
            return new GoogleIdentity(claims.getSubject(), email, claims.getStringClaim("name"),
                    claims.getStringClaim("picture"));
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Google ID token rejected: {}", ex.getMessage());
            throw invalid();
        }
    }

    private DefaultJWTProcessor<SecurityContext> processor() throws MalformedURLException {
        DefaultJWTProcessor<SecurityContext> p = processor;
        if (p == null) {
            synchronized (this) {
                if (processor == null) {
                    JWKSource<SecurityContext> keys = JWKSourceBuilder
                            .create(URI.create(props.jwksUri()).toURL())
                            .retrying(true)
                            .build();
                    DefaultJWTProcessor<SecurityContext> created = new DefaultJWTProcessor<>();
                    created.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, keys));
                    created.setJWTClaimsSetVerifier(new DefaultJWTClaimsVerifier<>(
                            props.clientId(),
                            null,
                            new HashSet<>(Set.of("sub", "iss", "exp", "iat", "email"))));
                    processor = created;
                }
                p = processor;
            }
        }
        return p;
    }

    private static BusinessException invalid() {
        return BusinessException.withDetail(StatusCode.INVALID_TOKEN, "idToken", "Google token is invalid");
    }
}
