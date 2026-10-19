package com.kosign.vbiz.marketplace.payload;

import java.time.Instant;
import java.util.List;

public record ListingReviewResponse(
        String id,
        String businessId,
        String targetId,
        String itemSlug,
        String authorName,
        int stars,
        String text,
        List<String> tags,
        String variantName,
        boolean verified,
        String reply,
        Instant at) {
}
