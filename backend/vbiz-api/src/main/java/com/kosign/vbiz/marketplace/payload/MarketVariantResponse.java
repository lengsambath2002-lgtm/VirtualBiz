package com.kosign.vbiz.marketplace.payload;

import java.math.BigDecimal;
import java.util.Map;

/** A variant as customers see it: live stock, no cost or barcode. */
public record MarketVariantResponse(
        String id,
        String productId,
        Map<String, String> options,
        BigDecimal price,
        BigDecimal compareAt,
        String sku,
        int stock,
        String swatch) {
}
