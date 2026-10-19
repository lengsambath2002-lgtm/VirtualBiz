package com.kosign.vbiz.auth.domain;

/** The sign-up waiting for its VERIFY code: stored with the code, never the plain password. */
public record PendingSignup(String name, String passwordHash) {
}
