package com.kosign.vbiz.admin.payload;

import java.time.Instant;

import com.kosign.vbiz.account.domain.PlatformRole;

/** A staff account in the console's Staff tab. */
public record StaffMemberRow(String id, String name, String email, String avatarUrl, PlatformRole role,
        boolean suspended, boolean mfaEnabled, Instant mfaEnabledAt, boolean mustChangePassword, Instant lastSeenAt,
        Instant joinedAt, boolean you) {
}
