package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;

import jakarta.validation.constraints.NotNull;

/** {@code PUT /api/admin/settings}: every value (super-admin). */
public record SettingsInput(@NotNull BigDecimal commissionPct, @NotNull Integer payoutDelayDays,
        @NotNull Integer khrPerUsd) {
}
