package com.kosign.vbiz.payment.payload;

import java.math.BigDecimal;
import java.time.Instant;

/** {@code OrderPayment}: the payment of one order. */
public record OrderPaymentResponse(String method, String channel, String status, boolean paid, BigDecimal amount,
        Instant paidAt) {
}
