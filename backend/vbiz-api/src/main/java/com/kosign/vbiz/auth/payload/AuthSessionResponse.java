package com.kosign.vbiz.auth.payload;

import com.kosign.vbiz.account.payload.UserResponse;

/** {@code AuthSession}: the access token (memory only on the client), its lifetime in seconds, and the user. */
public record AuthSessionResponse(String accessToken, long expiresIn, UserResponse user) {
}
