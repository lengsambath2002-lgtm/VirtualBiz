package com.kosign.vbiz.inventory.payload;

import java.util.UUID;

import com.kosign.vbiz.inventory.domain.StockReason;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code POST /api/inventory/movements}. */
public record StockWriteRequest(
        @NotNull UUID variantId,
        @NotNull Integer delta,
        @NotNull StockReason reason,
        @Size(max = 120) String note,
        Boolean mergeQuick,
        Boolean system) {
}
