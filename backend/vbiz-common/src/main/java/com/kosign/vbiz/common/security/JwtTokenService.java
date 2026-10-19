package com.kosign.vbiz.common.security;

import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import lombok.extern.slf4j.Slf4j;

/** Signs and verifies HS256 access tokens: {@code sub} = user id, {@code sid} = session id. */
@Slf4j
@Component
public class JwtTokenService {

    private static final String SESSION_CLAIM = "sid";

    private final JwtProperties props;
    private final Clock clock;
    private final JWSSigner signer;
    private final JWSVerifier verifier;

    public JwtTokenService(JwtProperties props, Clock clock) {
        this.props = props;
        this.clock = clock;
        byte[] secret = props.secret().getBytes(StandardCharsets.UTF_8);
        try {
            this.signer = new MACSigner(secret);
            this.verifier = new MACVerifier(secret);
        } catch (JOSEException ex) {
            throw new IllegalStateException("Invalid JWT secret", ex);
        }
    }

    public IssuedToken issue(UUID userId, UUID sessionId) {
        Instant now = clock.instant();
        Instant exp = now.plus(props.accessTtl());
        JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
                .issuer(props.issuer())
                .subject(userId.toString())
                .issueTime(Date.from(now))
                .expirationTime(Date.from(exp))
                .jwtID(UUID.randomUUID().toString());
        if (sessionId != null) {
            claims.claim(SESSION_CLAIM, sessionId.toString());
        }
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims.build());
        try {
            jwt.sign(signer);
        } catch (JOSEException ex) {
            throw new IllegalStateException("Could not sign access token", ex);
        }
        return new IssuedToken(jwt.serialize(), props.accessTtl().toSeconds());
    }

    /** The principal of a valid, unexpired token from this issuer; empty otherwise. */
    public Optional<AuthPrincipal> verify(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!JWSAlgorithm.HS256.equals(jwt.getHeader().getAlgorithm()) || !jwt.verify(verifier)) {
                return Optional.empty();
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            Date exp = claims.getExpirationTime();
            if (exp == null || !exp.toInstant().isAfter(clock.instant())
                    || !props.issuer().equals(claims.getIssuer()) || claims.getSubject() == null) {
                return Optional.empty();
            }
            String sid = claims.getStringClaim(SESSION_CLAIM);
            return Optional.of(new AuthPrincipal(
                    UUID.fromString(claims.getSubject()),
                    sid == null ? null : UUID.fromString(sid)));
        } catch (ParseException | JOSEException | IllegalArgumentException ex) {
            log.debug("Rejected access token: {}", ex.getMessage());
            return Optional.empty();
        }
    }
}
