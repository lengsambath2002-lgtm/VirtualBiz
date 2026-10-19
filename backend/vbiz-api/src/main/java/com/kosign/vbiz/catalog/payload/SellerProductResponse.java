package com.kosign.vbiz.catalog.payload;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.kosign.vbiz.catalog.domain.ProductOption;
import com.kosign.vbiz.catalog.domain.ProductStatus;

/** {@code SellerProduct}: the product with every variant, cost and barcode (merchant view). */
public record SellerProductResponse(
        String id,
        String slug,
        String businessId,
        String title,
        String description,
        String categoryId,
        String collection,
        ProductStatus status,
        List<ProductOption> options,
        List<SellerVariantResponse> variants,
        List<String> photos,
        Map<String, String> specs,
        int lowStockAt,
        int sold,
        double rating,
        Instant createdAt,
        Instant updatedAt) {
}
