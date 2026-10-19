package com.kosign.vbiz.promotion.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.promotion.domain.PromotionScope;
import com.kosign.vbiz.promotion.domain.PromotionState;
import com.kosign.vbiz.promotion.domain.PromotionType;

/** A shop's {@code Promotion} (docs/api/phase5-pos-promotions-reviews.md § Promotions). */
public record PromotionResponse(
        String id,
        String businessId,
        String name,
        PromotionType type,
        BigDecimal value,
        String code,
        PromotionScope scope,
        List<String> targetIds,
        BigDecimal minSpend,
        BigDecimal maxDiscount,
        Instant startsAt,
        Instant endsAt,
        int uses,
        Integer usageLimit,
        PromotionState state) {

    /** {@code POST /api/promotions/{id}/end}: the promotion and what Undo puts back. */
    public record Ended(PromotionResponse promotion, Instant previousEndsAt) {
    }
}
