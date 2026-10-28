package com.kosign.vbiz.auth.domain;

/** Single-use tickets handed out after a verified code: set a new password, or register a phone. */
public enum TicketKind {
    RESET,
    PHONE,
    /** Issued instead of a session to an account with two-step sign-in on (target = the sign-in method). */
    TWO_STEP,
    /** A started Business Platform sign-in: the token is the OAuth {@code state}; data holds the rest. */
    SSO_STATE,
    /** A platform identity waiting for its VirtualBiz account (user_id) to sign in and confirm the link. */
    SSO_LINK
}
