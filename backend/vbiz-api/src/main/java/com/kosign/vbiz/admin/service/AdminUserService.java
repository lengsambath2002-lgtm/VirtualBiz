package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.payload.AdminUserDetail;
import com.kosign.vbiz.admin.payload.AdminUserRow;
import com.kosign.vbiz.admin.payload.PageResponse;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.auth.service.SessionService;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * Accounts (docs/api/phase7-admin.md § Users): search, an account's file, suspension (signs it out
 * everywhere at once), forced sign-out and staff roles. Staff accounts can only be changed by a
 * super-admin, and nobody changes their own.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final AdminAccess access;
    private final AdminQueries queries;
    private final AuditLog audit;
    private final UserRepository users;
    private final SessionService sessions;
    private final Clock clock;

    @Transactional(readOnly = true)
    public PageResponse<AdminUserRow> list(String q, String kind, String status, Integer page, Integer size) {
        access.require();
        int[] p = AuditLog.paging(page, size);
        return queries.users(new AdminQueries.UserFilter(q, kind, status), p[0], p[1]);
    }

    @Transactional(readOnly = true)
    public AdminUserDetail get(UUID id) {
        access.require();
        return detail(id);
    }

    @Transactional
    public AdminUserDetail suspend(UUID id, String rawReason) {
        AdminAccess.Admin admin = access.require();
        String reason = AuditLog.requireReason(rawReason);
        User u = changeable(admin, id);
        if (u.isSuspended()) {
            throw new BusinessException(StatusCode.CONFLICT);
        }
        u.setSuspendedAt(clock.instant());
        u.setSuspendedReason(reason);
        users.saveAndFlush(u);
        int revoked = sessions.revokeAll(id);
        audit.record(admin, AuditLog.USER_SUSPENDED, AuditTarget.USER, id, u.getName(), reason,
                Map.of("sessionsRevoked", revoked));
        return detail(id);
    }

    @Transactional
    public AdminUserDetail reinstate(UUID id, String note) {
        AdminAccess.Admin admin = access.require();
        User u = changeable(admin, id);
        if (!u.isSuspended()) {
            throw new BusinessException(StatusCode.CONFLICT);
        }
        u.setSuspendedAt(null);
        u.setSuspendedReason(null);
        users.saveAndFlush(u);
        audit.record(admin, AuditLog.USER_REINSTATED, AuditTarget.USER, id, u.getName(), AuditLog.optional(note),
                null);
        return detail(id);
    }

    /** Signs the account out on every device (e.g. a stolen phone), without suspending it. */
    @Transactional
    public AdminUserDetail signOut(UUID id, String note) {
        AdminAccess.Admin admin = access.require();
        User u = changeable(admin, id);
        int revoked = sessions.revokeAll(id);
        audit.record(admin, AuditLog.USER_SIGNED_OUT, AuditTarget.USER, id, u.getName(), AuditLog.optional(note),
                Map.of("sessionsRevoked", revoked));
        return detail(id);
    }

    /** Super-admin only: make someone staff, change their level, or remove it (null). */
    @Transactional
    public AdminUserDetail setRole(UUID id, PlatformRole role) {
        AdminAccess.Admin admin = access.requireSuper();
        User u = changeable(admin, id);
        if (u.getPlatformRole() == role) {
            return detail(id);
        }
        Map<String, Object> change = new HashMap<>();
        change.put("from", u.getPlatformRole() == null ? null : u.getPlatformRole().name());
        change.put("to", role == null ? null : role.name());
        u.setPlatformRole(role);
        users.saveAndFlush(u);
        audit.record(admin, AuditLog.USER_ROLE_CHANGED, AuditTarget.USER, id, u.getName(), null, change);
        return detail(id);
    }

    /** The account another admin may change: not their own; a staff account needs a super-admin. */
    private User changeable(AdminAccess.Admin admin, UUID id) {
        User u = users.findById(id).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
        if (u.getId().equals(admin.id())) {
            throw BusinessException.withDetail(StatusCode.FORBIDDEN, "id", "You cannot change your own account here");
        }
        if (u.getPlatformRole() != null && !admin.isSuper()) {
            throw new BusinessException(StatusCode.SUPER_ADMIN_ONLY);
        }
        return u;
    }

    private AdminUserDetail detail(UUID id) {
        AdminUserRow row = queries.user(id).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
        User u = users.findById(id).orElseThrow();
        Instant now = clock.instant();
        Object[] act = queries.userActivity(id, now);
        return new AdminUserDetail(row, u.getSignInMethods().stream().map(Enum::name).sorted().toList(),
                u.getSuspendedReason(), (Instant) act[0], (Long) act[1], (Long) act[2], (Long) act[3],
                queries.memberships(id), queries.recentOrders(new AdminQueries.OrderFilter(null, null, null, id), 5),
                audit.of(AuditTarget.USER, id));
    }
}
