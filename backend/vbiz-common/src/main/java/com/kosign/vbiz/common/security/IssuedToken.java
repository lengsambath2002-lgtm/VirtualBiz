package com.kosign.vbiz.common.security;

/** A freshly signed access token and its lifetime in seconds. */
public record IssuedToken(String token, long expiresIn) {
}
