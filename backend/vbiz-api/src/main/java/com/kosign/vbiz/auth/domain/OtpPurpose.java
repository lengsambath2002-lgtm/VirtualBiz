package com.kosign.vbiz.auth.domain;

/** Why a one-time code was sent: verify sign-up, log in, reset a password, or confirm a phone. */
public enum OtpPurpose {
    VERIFY,
    LOGIN,
    RESET,
    PHONE
}
