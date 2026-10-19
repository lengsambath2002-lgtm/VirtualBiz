package com.kosign.vbiz.review.payload;

import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.review.domain.ReviewTarget;

/** A review as the shop sees it (docs/api/phase4-bookings-provider.md § Shapes). */
public record ShopReviewResponse(
        String id,
        ReviewTarget targetType,
        String targetId,
        String authorName,
        int stars,
        String text,
        List<String> tags,
        String variantName,
        boolean verified,
        String reply,
        Instant at) {
}
