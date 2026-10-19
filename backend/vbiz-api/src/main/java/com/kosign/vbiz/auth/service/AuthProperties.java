package com.kosign.vbiz.auth.service;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code vbiz.auth.*}.
 *
 * @param refreshTtl        refresh-token lifetime (cookie Max-Age), 30 days
 * @param cookieSecure      {@code Secure} flag on {@code vb_refresh}; off only on local http
 * @param googleDevEnabled  enables {@code POST /api/auth/google/dev} (local/dev only)
 */
@ConfigurationProperties(prefix = "vbiz.auth")
public record AuthProperties(Duration refreshTtl, Boolean cookieSecure, Boolean googleDevEnabled) {

    public AuthProperties {
        if (refreshTtl == null) {
            refreshTtl = Duration.ofDays(30);
        }
        if (cookieSecure == null) {
            cookieSecure = Boolean.TRUE;
        }
        if (googleDevEnabled == null) {
            googleDevEnabled = Boolean.FALSE;
        }
    }
}
