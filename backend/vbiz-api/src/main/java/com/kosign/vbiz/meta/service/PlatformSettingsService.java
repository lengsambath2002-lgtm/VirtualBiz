package com.kosign.vbiz.meta.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.meta.domain.PlatformSettings;
import com.kosign.vbiz.meta.payload.PlatformSettingsResponse;
import com.kosign.vbiz.meta.repository.PlatformSettingsRepository;

import lombok.RequiredArgsConstructor;

/**
 * The platform settings row: what payments, payouts and the console read. Who may change them and
 * the audit entry are the admin domain's job ({@code AdminSettingsService}).
 */
@Service
@RequiredArgsConstructor
public class PlatformSettingsService {

    private final PlatformSettingsRepository repo;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PlatformSettingsResponse current() {
        return view(row());
    }

    /** VirtualBiz's share of a paid online payment, in percent. */
    @Transactional(readOnly = true)
    public BigDecimal commissionPct() {
        return row().getCommissionPct();
    }

    /** How long after delivery / pickup a paid online payment waits before it can be paid out. */
    @Transactional(readOnly = true)
    public Duration payoutDelay() {
        return Duration.ofDays(row().getPayoutDelayDays());
    }

    /** Sets every value; returns the row before and after for the audit entry. */
    @Transactional
    public PlatformSettingsResponse[] update(BigDecimal commissionPct, int payoutDelayDays, int khrPerUsd, String by) {
        if (commissionPct == null || commissionPct.signum() < 0 || commissionPct.compareTo(BigDecimal.valueOf(30)) > 0
                || commissionPct.stripTrailingZeros().scale() > 2) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "commissionPct", "0–30, up to 2 decimals");
        }
        if (payoutDelayDays < 0 || payoutDelayDays > 30) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "payoutDelayDays", "0–30 days");
        }
        if (khrPerUsd < 1000 || khrPerUsd > 10000) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "khrPerUsd", "1,000–10,000 riel");
        }
        PlatformSettings s = row();
        PlatformSettingsResponse before = view(s);
        s.setCommissionPct(commissionPct.setScale(2, RoundingMode.UNNECESSARY));
        s.setPayoutDelayDays((short) payoutDelayDays);
        s.setKhrPerUsd(khrPerUsd);
        s.setUpdatedAt(clock.instant());
        s.setUpdatedBy(by);
        repo.saveAndFlush(s);
        return new PlatformSettingsResponse[] {before, view(s)};
    }

    private PlatformSettings row() {
        return repo.findById(PlatformSettings.ID).orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
    }

    private static PlatformSettingsResponse view(PlatformSettings s) {
        return new PlatformSettingsResponse(s.getCommissionPct(), s.getPayoutDelayDays(), s.getKhrPerUsd(),
                s.getUpdatedAt(), s.getUpdatedBy());
    }
}
