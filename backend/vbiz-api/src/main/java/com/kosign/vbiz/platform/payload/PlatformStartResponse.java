package com.kosign.vbiz.platform.payload;

/** Where to send the browser: the platform's authorize page for this sign-in. */
public record PlatformStartResponse(String authorizeUrl) {
}
