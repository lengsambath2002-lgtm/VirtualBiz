package com.kosign.vbiz.promotion.payload;

import java.time.Instant;
import java.util.List;

/** {@code Deal} on the wire: whole days ({@code start}, {@code end}) and the instants they cover. */
public record DealResponse(
        String id,
        String businessId,
        String title,
        String body,
        Integer discountPct,
        List<String> serviceIds,
        String start,
        String end,
        Instant startsAt,
        Instant endsAt,
        int views) {
}
