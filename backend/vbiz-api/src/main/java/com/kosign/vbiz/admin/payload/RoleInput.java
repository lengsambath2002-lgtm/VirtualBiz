package com.kosign.vbiz.admin.payload;

import com.kosign.vbiz.account.domain.PlatformRole;

/** {@code PUT /api/admin/users/{id}/role}: the new staff role, or null to make an ordinary account. */
public record RoleInput(PlatformRole role) {
}
