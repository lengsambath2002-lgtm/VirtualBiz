package com.kosign.vbiz.marketplace.payload;

import java.math.BigDecimal;
import java.util.List;

public record MarketServiceResponse(
        String type,
        String id,
        String slug,
        String businessId,
        String shopSlug,
        String name,
        String category,
        String description,
        int durationMin,
        BigDecimal price,
        Integer discountPct,
        List<String> staffIds,
        int sold,
        double rating) implements MarketItemResponse {
}
