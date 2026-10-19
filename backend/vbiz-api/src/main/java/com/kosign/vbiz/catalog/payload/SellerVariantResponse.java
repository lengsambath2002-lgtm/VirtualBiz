package com.kosign.vbiz.catalog.payload;

import java.math.BigDecimal;
import java.util.Map;

public record SellerVariantResponse(
        String id,
        String productId,
        Map<String, String> options,
        BigDecimal price,
        BigDecimal compareAt,
        BigDecimal cost,
        String sku,
        String barcode,
        int stock,
        String swatch) {
}
