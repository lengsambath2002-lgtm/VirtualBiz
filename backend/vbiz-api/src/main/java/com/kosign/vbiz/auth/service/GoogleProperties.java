package com.kosign.vbiz.auth.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** {@code vbiz.google.*}. Google sign-in answers {@code NOT_CONFIGURED} while {@code clientId} is blank. */
@ConfigurationProperties(prefix = "vbiz.google")
public record GoogleProperties(String clientId, String jwksUri) {

    public GoogleProperties {
        if (jwksUri == null || jwksUri.isBlank()) {
            jwksUri = "https://www.googleapis.com/oauth2/v3/certs";
        }
    }

    public boolean configured() {
        return clientId != null && !clientId.isBlank();
    }
}
