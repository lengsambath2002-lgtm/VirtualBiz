package com.kosign.vbiz.admin.payload;

import java.time.Instant;
import java.util.List;

/** A review in the moderation list. */
public record AdminReviewRow(
        String id,
        String businessId,
        String shopName,
        String targetType,
        String itemName,
        String authorId,
        String authorName,
        int stars,
        String text,
        List<String> tags,
        String reply,
        boolean verified,
        Instant at,
        Instant hiddenAt,
        String hiddenReason) {
}
