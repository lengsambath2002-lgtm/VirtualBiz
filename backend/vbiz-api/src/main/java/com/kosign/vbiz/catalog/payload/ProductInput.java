package com.kosign.vbiz.catalog.payload;

import java.util.List;
import java.util.Map;

import com.kosign.vbiz.catalog.domain.ProductStatus;

/** Create / replace a product (docs/api/phase2-catalog-inventory.md § Seller catalog). */
public record ProductInput(
        String title,
        String description,
        String collection,
        ProductStatus status,
        Integer lowStockAt,
        List<OptionInput> options,
        List<VariantInput> variants,
        List<String> photos,
        Map<String, String> specs) {
}
