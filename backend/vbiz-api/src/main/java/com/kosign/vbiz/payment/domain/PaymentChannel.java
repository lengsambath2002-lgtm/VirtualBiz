package com.kosign.vbiz.payment.domain;

/** Where the payment happened. Commission (5%) applies to {@code ONLINE} only. */
public enum PaymentChannel {
    ONLINE,
    COD,
    POS,
    /** Paid to the shop itself (a manual order paid up front): no commission, no payout. */
    DIRECT
}
