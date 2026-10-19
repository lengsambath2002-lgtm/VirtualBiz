package com.kosign.vbiz.review.payload;

import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.review.domain.ReviewTarget;

/** {@code MyReview} (docs/api/phase5-pos-promotions-reviews.md § Reviews). */
public record MyReviewResponse(
        String id,
        String orderNumber,
        String bookingNumber,
        String itemSlug,
        ReviewTarget itemType,
        int stars,
        List<String> tags,
        String text,
        String reply,
        Instant at) {
}
