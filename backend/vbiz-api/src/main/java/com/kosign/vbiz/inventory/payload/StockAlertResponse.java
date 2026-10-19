package com.kosign.vbiz.inventory.payload;

/** A variant of an ACTIVE product at or below the product's alert level. */
public record StockAlertResponse(
        String productId,
        String productTitle,
        String variantId,
        String variantName,
        String sku,
        int stock,
        int lowStockAt,
        String state) {
}
