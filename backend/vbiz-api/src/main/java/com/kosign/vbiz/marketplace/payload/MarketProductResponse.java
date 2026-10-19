package com.kosign.vbiz.marketplace.payload;

import java.util.List;
import java.util.Map;

import com.kosign.vbiz.catalog.domain.ProductOption;

public record MarketProductResponse(
        String type,
        String id,
        String slug,
        String businessId,
        String shopSlug,
        String title,
        String description,
        String categoryId,
        List<ProductOption> options,
        List<MarketVariantResponse> variants,
        List<String> photos,
        Map<String, String> specs,
        int sold,
        double rating) implements MarketItemResponse {
}
