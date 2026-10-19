package com.kosign.vbiz.catalog.payload;

import java.math.BigDecimal;
import java.util.List;

public record ProviderServiceResponse(
        String id,
        String slug,
        String businessId,
        String name,
        String category,
        String description,
        int durationMin,
        BigDecimal price,
        Integer discountPct,
        List<String> staffIds,
        boolean bookableOnline,
        int sold,
        double rating) {
}
