package com.kosign.vbiz.payment.event;

import java.util.UUID;

/** A KHQR / card session was paid: its orders can be placed (handled in the same transaction). */
public record PaymentConfirmed(UUID intentId) {
}
