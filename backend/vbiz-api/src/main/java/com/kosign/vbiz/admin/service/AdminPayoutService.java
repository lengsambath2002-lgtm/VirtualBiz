package com.kosign.vbiz.admin.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.domain.Payout;
import com.kosign.vbiz.admin.payload.PageResponse;
import com.kosign.vbiz.admin.payload.PayoutBalance;
import com.kosign.vbiz.admin.payload.PayoutInput;
import com.kosign.vbiz.admin.payload.PayoutResponse;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.admin.repository.PayoutRepository;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.VerificationStatus;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.meta.service.PlatformSettingsService;
import com.kosign.vbiz.notification.domain.NotificationKind;
import com.kosign.vbiz.notification.service.NotificationService;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;

/**
 * Shop payouts (docs/api/phase7-admin.md § Payouts). VirtualBiz collects online payments (KHQR,
 * card) and keeps its commission; a payment is released to the shop a day after its order was
 * delivered or picked up (platform settings). Staff transfer the balance to the shop's Bakong account and
 * record it here with the transfer reference; a refund of an already paid-out payment is taken
 * back from the next payout. Cash on delivery and counter sales never pass through VirtualBiz.
 */
@Service
@RequiredArgsConstructor
public class AdminPayoutService {

    private final AdminAccess access;
    private final AdminQueries queries;
    private final AuditLog audit;
    private final PayoutRepository payouts;
    private final BusinessRepository businesses;
    private final NotificationService notifications;
    private final PlatformSettingsService settings;
    private final EntityManager em;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<PayoutBalance> balances() {
        access.require();
        return queries.balances(releaseBefore());
    }

    @Transactional(readOnly = true)
    public PageResponse<PayoutResponse> history(UUID businessId, Integer page, Integer size) {
        access.require();
        int[] p = AuditLog.paging(page, size);
        return queries.payouts(businessId, p[0], p[1]);
    }

    @Transactional
    public PayoutResponse pay(PayoutInput in) {
        AdminAccess.Admin admin = access.require();
        String reference = in.reference() == null ? "" : in.reference().trim();
        if (reference.length() < 3) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "reference",
                    "The bank transfer reference (3–80 characters)");
        }
        Business b = businesses.findById(in.businessId())
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        if (b.getVerification() != VerificationStatus.VERIFIED) {
            throw new BusinessException(StatusCode.VERIFICATION_REQUIRED);
        }
        if (b.getBakongId() == null || b.getBakongId().isBlank()) {
            throw new BusinessException(StatusCode.PAYOUT_ACCOUNT_MISSING);
        }
        List<AdminQueries.Settled> rows = queries.lockSettlement(b.getId(), releaseBefore());
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal commission = BigDecimal.ZERO;
        for (AdminQueries.Settled s : rows) {
            gross = s.back() ? gross.subtract(s.amount()) : gross.add(s.amount());
            commission = s.back() ? commission.subtract(s.commission()) : commission.add(s.commission());
        }
        BigDecimal amount = Money.usd(gross.subtract(commission));
        if (rows.stream().noneMatch(s -> !s.back()) || amount.signum() <= 0) {
            throw new BusinessException(StatusCode.NOTHING_TO_PAY);
        }
        Instant now = clock.instant();
        Payout p = new Payout();
        p.setBusinessId(b.getId());
        p.setGross(Money.usd(gross));
        p.setCommission(Money.usd(commission));
        p.setAmount(amount);
        p.setPaymentsCount(rows.size());
        p.setBakongId(b.getBakongId());
        p.setReference(reference);
        p.setNote(AuditLog.optional(in.note()));
        p.setPaidAt(now);
        p.setPaidBy(admin.id());
        payouts.saveAndFlush(p);
        queries.settle(p.getId(), rows.stream().filter(s -> !s.back()).map(AdminQueries.Settled::id).toList(),
                rows.stream().filter(AdminQueries.Settled::back).map(AdminQueries.Settled::id).toList());
        audit.record(admin, AuditLog.PAYOUT_RECORDED, AuditTarget.PAYOUT, p.getId(), b.getName(), null,
                Map.of("amount", amount, "reference", reference, "bakongId", b.getBakongId(),
                        "businessId", b.getId().toString()));
        notifications.toBusiness(b.getId(), NotificationKind.PAYOUT_SENT,
                Map.of("amount", amount.toPlainString(), "bakongId", b.getBakongId(), "reference", reference),
                b.getType() == com.kosign.vbiz.business.domain.BusinessType.SERVICE ? "/provider/settings"
                        : "/seller/settings");
        em.flush();
        return queries.payouts(b.getId(), 0, 1).items().get(0);
    }

    private Instant releaseBefore() {
        return clock.instant().minus(settings.payoutDelay());
    }
}
