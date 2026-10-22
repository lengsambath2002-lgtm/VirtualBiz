package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.payload.ListParams;
import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.AdminBusinessDetail;
import com.kosign.vbiz.admin.payload.AdminBusinessRow;
import com.kosign.vbiz.admin.payload.IdPhotoResponse;
import com.kosign.vbiz.common.list.PageResponse;
import com.kosign.vbiz.admin.payload.PayoutBalance;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessDocument;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.VerificationStatus;
import com.kosign.vbiz.business.repository.BusinessDocumentRepository;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.meta.service.PlatformSettingsService;
import com.kosign.vbiz.notification.domain.NotificationKind;
import com.kosign.vbiz.notification.service.NotificationService;

import lombok.RequiredArgsConstructor;

/**
 * Shops (docs/api/phase7-admin.md § Shops): the list, a shop's file, the ID check (verify /
 * reject) and suspension. Each decision is audited and the shop's inbox is told.
 */
@Service
@RequiredArgsConstructor
public class AdminBusinessService {

    private static final Duration RECENT = Duration.ofDays(30);

    private final AdminAccess access;
    private final AdminQueries queries;
    private final AuditLog audit;
    private final BusinessRepository businesses;
    private final BusinessDocumentRepository documents;
    private final UserRepository users;
    private final NotificationService notifications;
    private final PlatformSettingsService settings;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<AdminBusinessRow> list(String q, BusinessType type, VerificationStatus verification,
            String status, String category, String district, ListParams lp) {
        access.require();
        return queries.businesses(filter(q, type, verification, status, category, district, lp),
                recentSince(), lp.pageNo(), lp.sizeNo());
    }

    public static AdminQueries.BusinessFilter filter(String q, BusinessType type, VerificationStatus verification,
            String status, String category, String district, ListParams lp) {
        return new AdminQueries.BusinessFilter(q, type, verification, status, category, district, lp.range(),
                lp.sort());
    }

    /** Orders and GMV columns count the last 30 days. */
    public Instant recentSince() {
        return clock.instant().minus(RECENT);
    }

    @Transactional(readOnly = true)
    public AdminBusinessDetail get(UUID id) {
        access.require();
        Instant now = clock.instant();
        AdminBusinessRow row = queries.business(id, now.minus(RECENT))
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        Business b = require(id);
        AdminBusinessDetail.Stats s = queries.businessStats(id);
        var payable = queries.balance(id, now.minus(settings.payoutDelay())).map(PayoutBalance::payable)
                .orElse(java.math.BigDecimal.ZERO);
        String verifiedBy = b.getVerifiedBy() == null ? null
                : users.findById(b.getVerifiedBy()).map(u -> u.getName()).orElse(null);
        return new AdminBusinessDetail(row, b.getAbout(), b.getPhone(), b.getEmail(), b.getStreet(), b.getBakongId(),
                b.getVerificationNote(), b.getVerifiedAt(), verifiedBy, b.getSuspendedReason(),
                new AdminBusinessDetail.Stats(s.orders(), s.gmv(), s.bookings(), s.products(), s.services(),
                        s.paidOut(), payable),
                queries.owner(id), queries.teamSize(id),
                queries.recentOrders(AdminQueries.OrderFilter.of(id, null), 5),
                audit.of(AuditTarget.BUSINESS, id));
    }

    @Transactional(readOnly = true)
    public IdPhotoResponse idPhoto(UUID id) {
        access.require();
        require(id);
        BusinessDocument d = documents.findFirstByBusinessIdAndKindOrderByCreatedAtDesc(id, BusinessDocument.ID_PHOTO)
                .orElseThrow(() -> new BusinessException(StatusCode.NOT_FOUND));
        return new IdPhotoResponse(d.getContentType(), d.getSizeBytes(),
                "data:" + d.getContentType() + ";base64," + Base64.getEncoder().encodeToString(d.getData()),
                d.getCreatedAt());
    }

    /** ID checked: payouts can start. Allowed from PENDING or REJECTED (a second look). */
    @Transactional
    public AdminBusinessDetail verify(UUID id, String note) {
        AdminAccess.Admin admin = access.require();
        Business b = require(id);
        if (b.getVerification() == VerificationStatus.VERIFIED) {
            throw new BusinessException(StatusCode.INVALID_STATUS_TRANSITION, b.getVerification(),
                    VerificationStatus.VERIFIED);
        }
        b.setVerification(VerificationStatus.VERIFIED);
        b.setVerificationNote(null);
        b.setVerifiedAt(clock.instant());
        b.setVerifiedBy(admin.id());
        audit.record(admin, AuditLog.BUSINESS_VERIFIED, AuditTarget.BUSINESS, id, b.getName(), AuditLog.optional(note),
                null);
        notifications.toBusiness(id, NotificationKind.BUSINESS_VERIFIED, Map.of("name", b.getName()),
                settingsRoute(b));
        businesses.flush();
        return get(id);
    }

    /** ID not accepted: the shop leaves the marketplace until the owner sends a new photo. */
    @Transactional
    public AdminBusinessDetail reject(UUID id, String rawReason) {
        AdminAccess.Admin admin = access.require();
        String reason = AuditLog.requireReason(rawReason);
        Business b = require(id);
        if (b.getVerification() == VerificationStatus.REJECTED) {
            throw new BusinessException(StatusCode.INVALID_STATUS_TRANSITION, b.getVerification(),
                    VerificationStatus.REJECTED);
        }
        Map<String, Object> was = Map.of("from", b.getVerification().name());
        b.setVerification(VerificationStatus.REJECTED);
        b.setVerificationNote(reason);
        b.setVerifiedAt(clock.instant());
        b.setVerifiedBy(admin.id());
        audit.record(admin, AuditLog.BUSINESS_REJECTED, AuditTarget.BUSINESS, id, b.getName(), reason, was);
        notifications.toBusiness(id, NotificationKind.BUSINESS_REJECTED, Map.of("name", b.getName(), "reason", reason),
                settingsRoute(b));
        businesses.flush();
        return get(id);
    }

    @Transactional
    public AdminBusinessDetail suspend(UUID id, String rawReason) {
        AdminAccess.Admin admin = access.require();
        String reason = AuditLog.requireReason(rawReason);
        Business b = require(id);
        if (b.isSuspended()) {
            throw new BusinessException(StatusCode.CONFLICT);
        }
        b.setSuspendedAt(clock.instant());
        b.setSuspendedReason(reason);
        audit.record(admin, AuditLog.BUSINESS_SUSPENDED, AuditTarget.BUSINESS, id, b.getName(), reason, null);
        notifications.toBusiness(id, NotificationKind.BUSINESS_SUSPENDED, Map.of("name", b.getName(), "reason", reason),
                settingsRoute(b));
        businesses.flush();
        return get(id);
    }

    @Transactional
    public AdminBusinessDetail reinstate(UUID id, String note) {
        AdminAccess.Admin admin = access.require();
        Business b = require(id);
        if (!b.isSuspended()) {
            throw new BusinessException(StatusCode.CONFLICT);
        }
        b.setSuspendedAt(null);
        b.setSuspendedReason(null);
        audit.record(admin, AuditLog.BUSINESS_REINSTATED, AuditTarget.BUSINESS, id, b.getName(),
                AuditLog.optional(note), null);
        notifications.toBusiness(id, NotificationKind.BUSINESS_REINSTATED, Map.of("name", b.getName()),
                settingsRoute(b));
        businesses.flush();
        return get(id);
    }

    private Business require(UUID id) {
        return businesses.findById(id).orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
    }

    private static String settingsRoute(Business b) {
        return b.getType() == BusinessType.SERVICE ? "/provider/settings" : "/seller/settings";
    }
}
