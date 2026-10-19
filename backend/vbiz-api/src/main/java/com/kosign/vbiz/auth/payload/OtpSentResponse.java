package com.kosign.vbiz.auth.payload;

import java.time.Instant;

/** A code was sent. {@code devCode} only when {@code vbiz.otp.expose-dev-code=true}. */
public record OtpSentResponse(Instant expiresAt, Instant resendAt, String devCode) {
}
