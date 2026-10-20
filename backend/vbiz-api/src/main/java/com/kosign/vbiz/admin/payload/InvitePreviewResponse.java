package com.kosign.vbiz.admin.payload;

import java.time.Instant;

import com.kosign.vbiz.account.domain.PlatformRole;

/**
 * {@code GET /api/staff-invites/{token}} (public): who is invited, and whether the email already
 * has an account (then its password confirms it is them).
 */
public record InvitePreviewResponse(String email, String name, PlatformRole role, String invitedBy,
        Instant expiresAt, boolean accountExists, boolean accountHasPassword) {
}
