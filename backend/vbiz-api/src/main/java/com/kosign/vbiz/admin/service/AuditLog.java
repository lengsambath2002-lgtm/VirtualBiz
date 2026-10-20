package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.admin.domain.AdminAudit;
import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.AuditEntry;
import com.kosign.vbiz.admin.repository.AdminAuditRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/** Writes the audit log (in the action's transaction, so an action and its entry stand or fall together). */
@Component
@RequiredArgsConstructor
public class AuditLog {

    // Actions (admin_audit.action).
    public static final String BUSINESS_VERIFIED = "BUSINESS_VERIFIED";
    public static final String BUSINESS_REJECTED = "BUSINESS_REJECTED";
    public static final String BUSINESS_SUSPENDED = "BUSINESS_SUSPENDED";
    public static final String BUSINESS_REINSTATED = "BUSINESS_REINSTATED";
    public static final String USER_SUSPENDED = "USER_SUSPENDED";
    public static final String USER_REINSTATED = "USER_REINSTATED";
    public static final String USER_ROLE_CHANGED = "USER_ROLE_CHANGED";
    public static final String USER_SIGNED_OUT = "USER_SIGNED_OUT";
    public static final String ORDER_CANCELLED = "ORDER_CANCELLED";
    public static final String ORDER_REFUNDED = "ORDER_REFUNDED";
    public static final String REVIEW_HIDDEN = "REVIEW_HIDDEN";
    public static final String REVIEW_RESTORED = "REVIEW_RESTORED";
    public static final String PROMOTION_CREATED = "PROMOTION_CREATED";
    public static final String PROMOTION_UPDATED = "PROMOTION_UPDATED";
    public static final String PROMOTION_ENDED = "PROMOTION_ENDED";
    public static final String PAYOUT_RECORDED = "PAYOUT_RECORDED";
    public static final String SETTINGS_UPDATED = "SETTINGS_UPDATED";
    public static final String CATEGORY_CREATED = "CATEGORY_CREATED";
    public static final String CATEGORY_UPDATED = "CATEGORY_UPDATED";
    public static final String CATEGORIES_REORDERED = "CATEGORIES_REORDERED";
    public static final String STAFF_INVITED = "STAFF_INVITED";
    public static final String STAFF_INVITE_REVOKED = "STAFF_INVITE_REVOKED";
    public static final String STAFF_JOINED = "STAFF_JOINED";
    public static final String STAFF_BOOTSTRAPPED = "STAFF_BOOTSTRAPPED";
    public static final String STAFF_MFA_RESET = "STAFF_MFA_RESET";
    public static final String MFA_ENABLED = "MFA_ENABLED";
    public static final String MFA_RECOVERY_USED = "MFA_RECOVERY_USED";
    public static final String MFA_RECOVERY_REGENERATED = "MFA_RECOVERY_REGENERATED";

    private final AdminAuditRepository audits;
    private final Clock clock;

    public void record(AdminAccess.Admin by, String action, AuditTarget type, Object targetId, String label,
            String reason, Map<String, Object> details) {
        AdminAudit a = new AdminAudit();
        a.setActorId(by.id());
        a.setActorName(by.name());
        a.setAction(action);
        a.setTargetType(type);
        a.setTargetId(String.valueOf(targetId));
        a.setTargetLabel(label == null ? null : label.length() > 200 ? label.substring(0, 200) : label);
        a.setReason(reason);
        a.setDetails(details == null ? new LinkedHashMap<>() : new LinkedHashMap<>(details));
        a.setAt(clock.instant());
        audits.save(a);
    }

    public List<AuditEntry> of(AuditTarget type, Object targetId) {
        return audits.findTop20ByTargetTypeAndTargetIdOrderByAtDesc(type, String.valueOf(targetId)).stream()
                .map(a -> new AuditEntry(a.getId().toString(), a.getActorId() == null ? null : a.getActorId().toString(),
                        a.getActorName(), a.getAction(), a.getTargetType().name(), a.getTargetId(), a.getTargetLabel(),
                        a.getReason(), a.getDetails(), a.getAt()))
                .toList();
    }

    /** A reason the affected person will read: 3–300 characters, required. */
    public static String requireReason(String raw) {
        String r = raw == null ? "" : raw.trim();
        if (r.length() < 3 || r.length() > 300) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "reason", "3–300 characters");
        }
        return r;
    }

    /** An optional note: trimmed, null when blank. */
    public static String optional(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    /** Page and size from query parameters (size 1–100, default 20). */
    public static int[] paging(Integer page, Integer size) {
        int p = page == null || page < 0 ? 0 : page;
        int s = size == null ? 20 : Math.max(1, Math.min(100, size));
        return new int[] {p, s};
    }
}
