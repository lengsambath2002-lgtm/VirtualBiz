package com.kosign.vbiz.auth.payload;

/** {@code {status:"SIGNED_IN", session}} for a known phone, {@code {status:"NEW", phoneToken}} otherwise. */
public record PhoneVerifyResponse(String status, AuthSessionResponse session, String phoneToken) {

    public static final String SIGNED_IN = "SIGNED_IN";
    public static final String NEW = "NEW";
}
