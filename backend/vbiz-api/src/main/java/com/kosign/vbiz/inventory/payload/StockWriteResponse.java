package com.kosign.vbiz.inventory.payload;

public record StockWriteResponse(StockMovementResponse movement, VariantStockResponse variant, boolean merged) {
}
