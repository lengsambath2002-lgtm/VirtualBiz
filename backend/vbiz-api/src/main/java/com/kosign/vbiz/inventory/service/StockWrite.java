package com.kosign.vbiz.inventory.service;

import java.util.UUID;

import com.kosign.vbiz.inventory.domain.StockReason;

/**
 * A stock change request for {@link StockWriter}. {@code byUserId}/{@code byName} null = automatic.
 * {@code mergeQuick} folds a QUICK_ADJUST into the same user's previous one within 60 s.
 */
public record StockWrite(
        UUID businessId,
        UUID variantId,
        int delta,
        StockReason reason,
        UUID byUserId,
        String byName,
        String note,
        boolean mergeQuick) {
}
