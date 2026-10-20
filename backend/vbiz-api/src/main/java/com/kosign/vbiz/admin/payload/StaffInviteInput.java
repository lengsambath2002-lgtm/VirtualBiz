package com.kosign.vbiz.admin.payload;

import com.kosign.vbiz.account.domain.PlatformRole;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** {@code POST /api/admin/staff/invites}. */
public record StaffInviteInput(@NotBlank String email, @NotBlank String name, @NotNull PlatformRole role) {
}
