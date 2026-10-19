package com.kosign.vbiz.auth.payload;

/** Service result of {@code phone/verify}; {@code refreshToken} is set only when signed in. */
public record PhoneVerifyResult(PhoneVerifyResponse body, String refreshToken) {
}
