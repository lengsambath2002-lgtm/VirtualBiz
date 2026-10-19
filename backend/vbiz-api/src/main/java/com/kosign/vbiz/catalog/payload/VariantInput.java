package com.kosign.vbiz.catalog.payload;

import java.math.BigDecimal;
import java.util.Map;

/**
 * A variant row of the product editor. {@code id} keeps an existing variant (any other value,
 * e.g. the editor's temporary id, is a new one). {@code stock} is the opening stock of a new variant.
 */
public record VariantInput(
        String id,
        Map<String, String> options,
        BigDecimal price,
        BigDecimal compareAt,
        BigDecimal cost,
        String sku,
        String barcode,
        String swatch,
        Integer stock) {
}
