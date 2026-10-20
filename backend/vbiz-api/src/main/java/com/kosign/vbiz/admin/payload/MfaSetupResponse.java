package com.kosign.vbiz.admin.payload;

/** A new two-step key to add to an authenticator app (QR of {@code otpauthUri}, or type {@code secret}). */
public record MfaSetupResponse(String secret, String otpauthUri) {
}
