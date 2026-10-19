package com.kosign.vbiz.marketplace.payload;

import java.time.Instant;
import java.util.List;

public record MarketDealResponse(
        String id,
        String businessId,
        String shopSlug,
        String title,
        String body,
        Integer discountPct,
        List<String> serviceIds,
        Instant startsAt,
        Instant endsAt) {
}
