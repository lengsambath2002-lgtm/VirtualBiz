package com.kosign.vbiz.promotion.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.promotion.domain.PromotionScope;
import com.kosign.vbiz.promotion.domain.PromotionType;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/promotions} (name, type, value, scope, startsAt, endsAt required) and
 * {@code PATCH /api/promotions/{id}} (only the fields present change; an empty {@code code} makes
 * it automatic, 0 clears {@code minSpend}, {@code maxDiscount} and {@code usageLimit}).
 */
public record PromotionInput(
        @Size(max = 60) String name,
        PromotionType type,
        @DecimalMin("0") BigDecimal value,
        @Size(max = 20) String code,
        PromotionScope scope,
        @Size(max = 200) List<String> targetIds,
        @DecimalMin("0") BigDecimal minSpend,
        @DecimalMin("0") BigDecimal maxDiscount,
        Instant startsAt,
        Instant endsAt,
        @Min(0) Integer usageLimit) {
}
