package com.kosign.vbiz.marketplace.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.kosign.vbiz.promotion.domain.PromotionScope;
import com.kosign.vbiz.promotion.domain.PromotionType;

/** {@code Promotion} (domain model). {@code businessId} is always present (null = platform). */
public record PromotionResponse(
        String id,
        @JsonInclude(JsonInclude.Include.ALWAYS) String businessId,
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
        Integer usageLimit) {
}
