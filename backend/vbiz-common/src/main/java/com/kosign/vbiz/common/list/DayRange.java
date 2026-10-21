package com.kosign.vbiz.common.list;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/**
 * A list's date filter ({@code ?from=2026-10-01&to=2026-10-21}): Phnom Penh days, {@code to}
 * inclusive. Either end may be left out.
 */
public record DayRange(LocalDate from, LocalDate to) {

    public static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");

    /** {@code null} when neither end is given; at most {@code maxDays} long when both are. */
    public static DayRange of(LocalDate from, LocalDate to, int maxDays) {
        if (from == null && to == null) {
            return null;
        }
        if (from != null && to != null) {
            if (from.isAfter(to)) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "from", "on or before to");
            }
            if (ChronoUnit.DAYS.between(from, to) >= maxDays) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "to", "at most " + maxDays + " days");
            }
        }
        return new DayRange(from, to);
    }

    /** Start of {@code from} (inclusive), or {@code null}. */
    public Instant start() {
        return from == null ? null : from.atStartOfDay(PHNOM_PENH).toInstant();
    }

    /** Start of the day after {@code to} (exclusive), or {@code null}. */
    public Instant end() {
        return to == null ? null : to.plusDays(1).atStartOfDay(PHNOM_PENH).toInstant();
    }
}
