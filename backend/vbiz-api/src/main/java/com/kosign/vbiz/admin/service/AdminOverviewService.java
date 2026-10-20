package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.payload.OverviewResponse;
import com.kosign.vbiz.admin.payload.PayoutBalance;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.meta.service.PlatformSettingsService;

import lombok.RequiredArgsConstructor;

/** {@code GET /api/admin/overview}: the platform's numbers and what is waiting for staff. */
@Service
@RequiredArgsConstructor
public class AdminOverviewService {

    static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");

    private final AdminAccess access;
    private final AdminQueries queries;
    private final PlatformSettingsService settings;
    private final Clock clock;

    @Transactional(readOnly = true)
    public OverviewResponse overview(Integer days) {
        access.require();
        int n = days == null ? 30 : days;
        if (n != 7 && n != 30 && n != 90) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "days", "7, 30 or 90");
        }
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, PHNOM_PENH);
        Instant end = start(today.plusDays(1));
        long[] q = queries.queueCounts(now);
        var balances = queries.balances(now.minus(settings.payoutDelay()));
        var due = balances.stream().map(PayoutBalance::payable).filter(p -> p.signum() > 0)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        long dueShops = balances.stream().filter(b -> b.payable().signum() > 0).count();
        Instant from = start(today.minusDays(n - 1L));
        return new OverviewResponse(
                n,
                queries.period(start(today), end),
                queries.period(from, end),
                queries.period(start(today.minusDays(2L * n - 1)), from),
                queries.counts(),
                new OverviewResponse.Queues(q[0], q[1], due, dueShops, q[2], q[3], q[4]),
                queries.days(today.minusDays(n - 1L), today),
                queries.topShops(from, 5),
                queries.categorySales(from));
    }

    static Instant start(LocalDate day) {
        return day.atStartOfDay(PHNOM_PENH).toInstant();
    }
}
