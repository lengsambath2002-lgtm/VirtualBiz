package com.kosign.vbiz.promotion.payload;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/deals} (title, body, start, end required) and {@code PATCH /api/deals/{id}}
 * (only the fields present change; {@code discountPct} 0 clears it). Dates are Phnom Penh days.
 */
public record DealInput(
        @Size(max = 120) String title,
        @Size(max = 500) String body,
        @Min(0) @Max(100) Integer discountPct,
        @Size(max = 50) List<UUID> serviceIds,
        LocalDate start,
        LocalDate end) {
}
