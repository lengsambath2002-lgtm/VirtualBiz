package com.kosign.vbiz.payment.domain;

/** Status of one order's payment. COD stays PENDING until the goods are handed over. */
public enum PaymentStatus {
    PENDING,
    PAID,
    REFUNDED,
    CANCELLED,
    EXPIRED
}
