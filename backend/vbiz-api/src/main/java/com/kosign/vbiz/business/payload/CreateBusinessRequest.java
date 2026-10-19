package com.kosign.vbiz.business.payload;

import java.math.BigDecimal;

import com.kosign.vbiz.business.domain.BusinessType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/businesses} (the Create Business wizard). {@code idPhoto} is a data URL.
 * "Get paid" ({@code bakongId}, {@code idPhoto}) is optional: it can be added in Settings later.
 */
public record CreateBusinessRequest(
        @NotNull BusinessType type,
        @NotBlank @Size(min = 2, max = 80) String name,
        @NotBlank @Size(max = 40) String categoryId,
        @NotBlank @Size(max = 80) String district,
        @NotBlank @Size(min = 3, max = 200) String street,
        @DecimalMin("-90") @DecimalMax("90") BigDecimal lat,
        @DecimalMin("-180") @DecimalMax("180") BigDecimal lng,
        @NotBlank @Size(max = 20) String phone,
        @NotNull @Valid HoursInput hours,
        @Size(max = 100) String bakongId,
        String idPhoto) {
}
