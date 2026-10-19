package com.kosign.vbiz.pos.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** {@code Shift} (docs/api/phase5-pos-promotions-reviews.md § POS). */
public record ShiftResponse(
        String id,
        Instant openedAt,
        String openedBy,
        String openedByName,
        BigDecimal floatUsd,
        long floatKhr,
        List<Move> moves,
        BigDecimal cashSales,
        BigDecimal cashRefunds,
        BigDecimal expectedUsd,
        Instant closedAt,
        String closedByName,
        BigDecimal countedUsd,
        BigDecimal difference) {

    public record Move(BigDecimal amount, String note, Instant at, String byName) {
    }
}
