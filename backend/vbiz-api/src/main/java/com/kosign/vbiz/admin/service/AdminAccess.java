package com.kosign.vbiz.admin.service;

import java.util.UUID;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.CurrentUser;

import lombok.RequiredArgsConstructor;

/**
 * Who may use {@code /api/admin/**}: signed-in staff ({@code ADMIN} or {@code SUPER_ADMIN}). Every
 * admin service method starts here; anyone else gets {@code ADMIN_ONLY}.
 */
@Component
@RequiredArgsConstructor
public class AdminAccess {

    private final UserRepository users;

    /** The acting admin. */
    public record Admin(UUID id, String name, PlatformRole role) {

        public boolean isSuper() {
            return role == PlatformRole.SUPER_ADMIN;
        }
    }

    public Admin require() {
        User u = users.findById(CurrentUser.id()).orElseThrow(() -> new BusinessException(StatusCode.UNAUTHORIZED));
        if (u.getPlatformRole() == null || u.isSuspended()) {
            throw new BusinessException(StatusCode.ADMIN_ONLY);
        }
        return new Admin(u.getId(), u.getName(), u.getPlatformRole());
    }

    public Admin requireSuper() {
        Admin a = require();
        if (!a.isSuper()) {
            throw new BusinessException(StatusCode.SUPER_ADMIN_ONLY);
        }
        return a;
    }
}
