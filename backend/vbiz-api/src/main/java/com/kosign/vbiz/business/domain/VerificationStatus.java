package com.kosign.vbiz.business.domain;

/** ID verification state of a business. Payouts start once {@code VERIFIED}. */
public enum VerificationStatus {
    PENDING,
    VERIFIED,
    REJECTED
}
