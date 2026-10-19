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

import lombok.RequiredArgsConstructor;

/** {@code GET /api/admin/overview}: the platform's numbers and what is waiting for staff. */
@Service
@RequiredArgsConstructor
public class AdminOverviewService {

    static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");

    private final AdminAccess access;
    private final AdminQueries queries;
    private final PayoutProperties payoutProps;
    private final Clock clock;

    @Transactional(readOnly = true)
    public OverviewResponse overview() {
        access.require();
        Instant now = clock.instant();
        LocalDate today = LocalDate.ofInstant(now, PHNOM_PENH);
        Instant end = start(today.plusDays(1));
        long[] q = queries.queueCounts(now);
        var balances = queries.balances(now.minus(payoutProps.releaseAfter()));
        var due = balances.stream().map(PayoutBalance::payable).filter(p -> p.signum() > 0)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        long dueShops = balances.stream().filter(b -> b.payable().signum() > 0).count();
        return new OverviewResponse(
                queries.period(start(today), end),
                queries.period(start(today.minusDays(6)), end),
                queries.period(start(today.minusDays(29)), end),
                queries.period(start(today.minusDays(59)), start(today.minusDays(29))),
                queries.counts(),
                new OverviewResponse.Queues(q[0], q[1], due, dueShops, q[2], q[3], q[4]),
                queries.days(today.minusDays(29), today),
                queries.topShops(start(today.minusDays(29)), 5));
    }

    static Instant start(LocalDate day) {
        return day.atStartOfDay(PHNOM_PENH).toInstant();
    }
}
