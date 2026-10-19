package com.kosign.vbiz.payment.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** {@code PaymentIntent} on the wire. */
public record PaymentIntentResponse(String id, String method, String status, BigDecimal amount, String currency,
        String khqr, String md5, Instant expiresAt, Instant paidAt, List<String> orderNumbers) {
}
