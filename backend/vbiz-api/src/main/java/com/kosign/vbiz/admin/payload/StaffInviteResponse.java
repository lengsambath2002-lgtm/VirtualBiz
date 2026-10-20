package com.kosign.vbiz.admin.payload;

import java.time.Instant;

import com.kosign.vbiz.account.domain.PlatformRole;

/** An open staff invite. {@code devLink} (path) only where {@code vbiz.staff.expose-dev-links}. */
public record StaffInviteResponse(String id, String email, String name, PlatformRole role, String invitedByName,
        Instant createdAt, Instant expiresAt, boolean expired, String devLink) {
}
