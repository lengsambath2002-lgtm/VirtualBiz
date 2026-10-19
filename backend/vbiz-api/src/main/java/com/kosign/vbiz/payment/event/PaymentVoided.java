package com.kosign.vbiz.payment.event;

import java.util.UUID;

/**
 * A pending session will never be paid ({@code reason}: {@code paymentExpired} or
 * {@code paymentCancelled}): its orders are cancelled and restocked in the same transaction.
 */
public record PaymentVoided(UUID intentId, String reason) {
}
