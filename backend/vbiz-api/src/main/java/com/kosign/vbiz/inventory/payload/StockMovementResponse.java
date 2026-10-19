package com.kosign.vbiz.inventory.payload;

import java.time.Instant;

import com.kosign.vbiz.inventory.domain.StockReason;

public record StockMovementResponse(
        String id,
        String variantId,
        String productId,
        int delta,
        StockReason reason,
        String byUserId,
        String byName,
        String note,
        Instant at) {
}
