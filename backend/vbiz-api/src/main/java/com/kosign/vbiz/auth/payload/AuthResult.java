package com.kosign.vbiz.auth.payload;

/** Service result of a sign-in: the session for the body and the refresh token for the cookie. */
public record AuthResult(AuthSessionResponse session, String refreshToken) {
}
