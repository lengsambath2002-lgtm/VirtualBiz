package com.kosign.vbiz.payment.domain;

/** Status of a gateway session (one KHQR or card charge for a whole checkout). */
public enum IntentStatus {
    PENDING,
    PAID,
    EXPIRED,
    CANCELLED,
    FAILED
}
