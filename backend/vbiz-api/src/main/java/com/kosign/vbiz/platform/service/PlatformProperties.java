package com.kosign.vbiz.platform.service;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code vbiz.platform.*}: single sign-on with the Business Platform (docs/adr/0003-sso-with-the-business-platform.md).
 * The feature is off (sign-in button hidden, endpoints answer {@code NOT_CONFIGURED}) until
 * {@code url}, {@code clientId} and {@code clientSecret} are all set.
 *
 * @param url                  the platform's public web origin ({@code VBIZ_PLATFORM_URL}); also the token issuer
 * @param clientId             VirtualBiz's client id at the platform ({@code VBIZ_PLATFORM_CLIENT_ID})
 * @param clientSecret         its secret ({@code VBIZ_PLATFORM_CLIENT_SECRET}); env only, never logged
 * @param appUrl               the VirtualBiz web origin; the redirect URI is {@code {appUrl}/platform/callback}
 * @param connectTtl           how fresh the organisation roles from the last platform sign-in must be to connect a shop
 * @param jwksRefetchInterval  the least time between key-set fetches caused by an unknown {@code kid}
 * @param connectTimeout       HTTP connect timeout to the platform
 * @param readTimeout          HTTP read timeout to the platform
 */
@ConfigurationProperties(prefix = "vbiz.platform")
public record PlatformProperties(String url, String clientId, String clientSecret, String appUrl,
        Duration connectTtl, Duration jwksRefetchInterval, Duration connectTimeout, Duration readTimeout) {

    public static final String CALLBACK_PATH = "/platform/callback";

    public PlatformProperties {
        url = trimSlash(url);
        appUrl = trimSlash(appUrl == null || appUrl.isBlank() ? "http://localhost:3000" : appUrl);
        clientId = clientId == null ? "" : clientId.trim();
        connectTtl = connectTtl == null ? Duration.ofMinutes(10) : connectTtl;
        jwksRefetchInterval = jwksRefetchInterval == null ? Duration.ofSeconds(30) : jwksRefetchInterval;
        connectTimeout = connectTimeout == null ? Duration.ofSeconds(5) : connectTimeout;
        readTimeout = readTimeout == null ? Duration.ofSeconds(10) : readTimeout;
    }

    public boolean configured() {
        return !url.isEmpty() && !clientId.isEmpty() && clientSecret != null && !clientSecret.isBlank();
    }

    /** {@code {VBIZ_APP_URL}/platform/callback}: registered exactly at the platform. */
    public String redirectUri() {
        return appUrl + CALLBACK_PATH;
    }

    private static String trimSlash(String s) {
        String v = s == null ? "" : s.trim();
        while (v.endsWith("/")) {
            v = v.substring(0, v.length() - 1);
        }
        return v;
    }

    /** Never print the secret (records' default toString would). */
    @Override
    public String toString() {
        return "PlatformProperties[url=" + url + ", clientId=" + clientId + ", clientSecret=" + (configured() ? "***" : "")
                + ", appUrl=" + appUrl + "]";
    }
}
