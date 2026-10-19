package com.kosign.vbiz.common.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Access-token settings ({@code vbiz.jwt.*}). The secret comes from {@code VBIZ_JWT_SECRET};
 * only the local and test profiles carry a default. HS256 needs at least 32 bytes.
 */
@ConfigurationProperties(prefix = "vbiz.jwt")
public record JwtProperties(String secret, Duration accessTtl, String issuer) {

    public JwtProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("vbiz.jwt.secret (VBIZ_JWT_SECRET) must be set to at least 32 bytes");
        }
        if (accessTtl == null) {
            accessTtl = Duration.ofMinutes(15);
        }
        if (issuer == null || issuer.isBlank()) {
            issuer = "vbiz";
        }
    }
}
