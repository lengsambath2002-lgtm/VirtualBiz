package com.kosign.vbiz.firebase;

/**
 * Who a verified Firebase ID token says signed in. {@code provider}: {@code google.com} or
 * {@code password}.
 */
public record FirebaseIdentity(String uid, String email, boolean emailVerified, String name, String picture,
        String provider) {

    public boolean google() {
        return "google.com".equals(provider);
    }
}
