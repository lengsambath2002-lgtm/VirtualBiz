package com.kosign.vbiz.auth.domain;

/** Single-use tickets handed out after a verified code: set a new password, or register a phone. */
public enum TicketKind {
    RESET,
    PHONE,
    /** Issued instead of a session to an account with two-step sign-in on (target = the sign-in method). */
    TWO_STEP
}
