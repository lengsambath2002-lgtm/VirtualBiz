package com.kosign.vbiz.admin.service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

import org.springframework.stereotype.Service;

import com.kosign.vbiz.admin.payload.BulkInput;
import com.kosign.vbiz.admin.payload.BulkResult;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * Bulk actions on console lists (docs/api/phase15-lists.md). Each row runs through the same service
 * method, transaction, rules, audit entry and notification as the single action; a row it refuses
 * (already verified, last super-admin …) is reported and the others still go.
 */
@Service
@RequiredArgsConstructor
public class AdminBulkService {

    private final AdminAccess access;
    private final AdminBusinessService businesses;
    private final AdminUserService users;
    private final AdminReviewService reviews;

    public BulkResult businesses(BulkInput in) {
        access.require();
        return run(in.ids(), switch (in.action()) {
            case "verify" -> id -> businesses.verify(id, in.reason());
            case "reject" -> {
                String why = reason(in);
                yield id -> businesses.reject(id, why);
            }
            case "suspend" -> {
                String why = reason(in);
                yield id -> businesses.suspend(id, why);
            }
            case "reinstate" -> id -> businesses.reinstate(id, in.reason());
            default -> throw badAction("verify, reject, suspend, reinstate");
        });
    }

    public BulkResult users(BulkInput in) {
        access.require();
        return run(in.ids(), switch (in.action()) {
            case "suspend" -> {
                String why = reason(in);
                yield id -> users.suspend(id, why);
            }
            case "reinstate" -> id -> users.reinstate(id, in.reason());
            case "signOut" -> id -> users.signOut(id, in.reason());
            default -> throw badAction("suspend, reinstate, signOut");
        });
    }

    public BulkResult reviews(BulkInput in) {
        access.require();
        return run(in.ids(), switch (in.action()) {
            case "hide" -> {
                String why = reason(in);
                yield id -> reviews.hide(id, why);
            }
            case "restore" -> id -> reviews.restore(id, in.reason());
            default -> throw badAction("hide, restore");
        });
    }

    private static BulkResult run(List<UUID> ids, Consumer<UUID> one) {
        int done = 0;
        List<BulkResult.Failure> failed = new ArrayList<>();
        for (UUID id : ids.stream().distinct().toList()) {
            try {
                one.accept(id);
                done++;
            } catch (BusinessException e) {
                failed.add(new BulkResult.Failure(id.toString(), e.getStatusCode().name(), e.getMessage()));
            }
        }
        return new BulkResult(done, failed);
    }

    /** Checked once, before any row: a missing reason refuses the whole request. */
    private static String reason(BulkInput in) {
        return AuditLog.requireReason(in.reason());
    }

    private static BusinessException badAction(String allowed) {
        return BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "action", "one of " + allowed);
    }
}
