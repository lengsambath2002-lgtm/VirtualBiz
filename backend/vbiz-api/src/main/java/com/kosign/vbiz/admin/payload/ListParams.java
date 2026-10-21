package com.kosign.vbiz.admin.payload;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;

import com.kosign.vbiz.admin.service.AuditLog;
import com.kosign.vbiz.common.list.DayRange;

/**
 * What every console list takes besides its own filters: {@code page} (0-based), {@code size}
 * (1–100), {@code sort} (a key of the list, {@code -} for descending) and a {@code from} / {@code to}
 * range of Phnom Penh days (up to 10 years).
 */
public record ListParams(Integer page, Integer size, String sort,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

    public static final int MAX_DAYS = 3660;

    public int pageNo() {
        return AuditLog.paging(page, size)[0];
    }

    public int sizeNo() {
        return AuditLog.paging(page, size)[1];
    }

    public DayRange range() {
        return DayRange.of(from, to, MAX_DAYS);
    }
}
