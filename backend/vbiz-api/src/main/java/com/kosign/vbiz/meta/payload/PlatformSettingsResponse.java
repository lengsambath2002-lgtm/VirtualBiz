package com.kosign.vbiz.meta.payload;

import java.math.BigDecimal;
import java.time.Instant;

/** {@code GET /api/meta/settings} (public) and the console's settings page. */
public record PlatformSettingsResponse(BigDecimal commissionPct, int payoutDelayDays, int khrPerUsd,
        Instant updatedAt, String updatedBy) {
}
