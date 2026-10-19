package com.kosign.vbiz.common.helper;

import java.math.BigDecimal;
import java.math.RoundingMode;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/**
 * The one place money is shaped. Amounts are USD {@link BigDecimal} with scale 2
 * ({@code NUMERIC(12,2)} in the DB). KHR is derived, never stored (except cash tendered at
 * the POS): {@code round(usd × rate / 100) × 100}. Mirrors {@code frontend/src/lib/money/}
 * and {@code VBizDomain}; change all three together.
 */
public final class Money {

    public static final int SCALE = 2;
    public static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

    /** Default rate. The live rate belongs to {@code meta}; pass it via {@link #toKhr(BigDecimal, long)}. */
    public static final long DEFAULT_KHR_PER_USD = 4_100L;

    /** KHR amounts are rounded to the nearest 100 riel. */
    public static final long KHR_STEP = 100L;

    /** Largest value {@code NUMERIC(12,2)} can hold. */
    public static final BigDecimal MAX_USD = new BigDecimal("9999999999.99");

    public static final BigDecimal ZERO = BigDecimal.ZERO.setScale(SCALE);

    private Money() {
    }

    /** Normalizes to scale 2 (half-up). Throws {@code INVALID_AMOUNT} on null or overflow. */
    public static BigDecimal usd(BigDecimal amount) {
        if (amount == null) {
            throw new BusinessException(StatusCode.INVALID_AMOUNT);
        }
        BigDecimal scaled = amount.setScale(SCALE, ROUNDING);
        if (scaled.abs().compareTo(MAX_USD) > 0) {
            throw new BusinessException(StatusCode.INVALID_AMOUNT);
        }
        return scaled;
    }

    /** Parses a decimal string such as {@code "12.5"}. Throws {@code INVALID_AMOUNT} if unparseable. */
    public static BigDecimal usd(String amount) {
        if (amount == null || amount.isBlank()) {
            throw new BusinessException(StatusCode.INVALID_AMOUNT);
        }
        try {
            return usd(new BigDecimal(amount.trim()));
        } catch (NumberFormatException ex) {
            throw new BusinessException(StatusCode.INVALID_AMOUNT, ex);
        }
    }

    /** Converts cents to dollars, e.g. {@code 1250 → 12.50}. */
    public static BigDecimal ofCents(long cents) {
        return BigDecimal.valueOf(cents, SCALE);
    }

    /** Riel at the default rate, rounded to the nearest 100. */
    public static long toKhr(BigDecimal usd) {
        return toKhr(usd, DEFAULT_KHR_PER_USD);
    }

    /** Riel at {@code khrPerUsd}, rounded half-up to the nearest 100. */
    public static long toKhr(BigDecimal usd, long khrPerUsd) {
        if (usd == null) {
            throw new BusinessException(StatusCode.INVALID_AMOUNT);
        }
        if (khrPerUsd <= 0) {
            throw new IllegalArgumentException("khrPerUsd must be positive");
        }
        BigDecimal hundreds = usd.multiply(BigDecimal.valueOf(khrPerUsd))
                .divide(BigDecimal.valueOf(KHR_STEP), 0, ROUNDING);
        return hundreds.longValueExact() * KHR_STEP;
    }

    /** {@code percent}% of {@code amount}, scale 2 half-up. E.g. the 5% online commission. */
    public static BigDecimal percentOf(BigDecimal amount, BigDecimal percent) {
        return usd(amount.multiply(percent).divide(BigDecimal.valueOf(100), SCALE, ROUNDING));
    }
}
