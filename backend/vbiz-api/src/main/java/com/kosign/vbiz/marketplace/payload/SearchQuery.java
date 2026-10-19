package com.kosign.vbiz.marketplace.payload;

import java.math.BigDecimal;
import java.util.List;

/** Parsed search parameters (docs/api/phase2-catalog-inventory.md § Search). */
public record SearchQuery(
        String q,
        String type,
        List<String> categories,
        BigDecimal min,
        BigDecimal max,
        Double rating,
        boolean sale,
        boolean open,
        boolean freeDel,
        String sort,
        Double lat,
        Double lng,
        String district) {
}
