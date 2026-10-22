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
        String district,
        int page,
        int size) {

    /** Results per page when none is asked for, and the most a page may hold. */
    public static final int DEFAULT_SIZE = 24;
    public static final int MAX_SIZE = 60;
}
