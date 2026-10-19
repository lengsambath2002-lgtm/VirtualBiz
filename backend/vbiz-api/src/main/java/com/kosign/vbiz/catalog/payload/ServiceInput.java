package com.kosign.vbiz.catalog.payload;

import java.math.BigDecimal;
import java.util.List;

/** Create (all required except description / discountPct) or patch (absent = unchanged) a service. */
public record ServiceInput(
        String name,
        String category,
        String description,
        Integer durationMin,
        BigDecimal price,
        Integer discountPct,
        List<String> staffIds,
        Boolean bookableOnline) {
}
