package com.kosign.vbiz.admin.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.payload.StaffMemberRow;
import com.kosign.vbiz.admin.repository.AdminQueries;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * The console's Staff tab: every staff account with its sign-in security, and a super-admin's
 * "reset two-step sign-in" for someone who lost their phone. Roles, suspension and removal go
 * through {@link AdminUserService} (same guards and audit).
 */
@Service
@RequiredArgsConstructor
public class AdminStaffService {

    private final AdminAccess access;
    private final UserRepository users;
    private final AdminQueries queries;
    private final MfaService mfa;

    @Transactional(readOnly = true)
    public List<StaffMemberRow> list() {
        AdminAccess.Admin me = access.require();
        List<User> staff = users.findByPlatformRoleIsNotNullOrderByNameAsc();
        Map<UUID, Instant> seen = queries.lastSeen(staff.stream().map(User::getId).toList());
        return staff.stream().map(u -> new StaffMemberRow(u.getId().toString(), u.getName(), u.getEmail(),
                u.getAvatarUrl(), u.getPlatformRole(), u.isSuspended(), u.hasMfa(), u.getMfaEnabledAt(),
                u.isMustChangePassword(), seen.get(u.getId()), u.getCreatedAt(), u.getId().equals(me.id())))
                .toList();
    }

    @Transactional
    public void resetMfa(UUID id, String reason) {
        AdminAccess.Admin admin = access.requireSuper();
        User u = users.findById(id).filter(User::isStaff)
                .orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
        if (u.getId().equals(admin.id())) {
            throw BusinessException.withDetail(StatusCode.FORBIDDEN, "id", "Ask another super-admin");
        }
        mfa.reset(admin, u, AuditLog.requireReason(reason));
    }
}
