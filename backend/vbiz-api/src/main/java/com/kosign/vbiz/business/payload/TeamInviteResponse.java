package com.kosign.vbiz.business.payload;

import java.time.Instant;

import com.kosign.vbiz.business.domain.MemberRole;

/** An open team invite. {@code devLink} (path) only where invite links are exposed (local, test). */
public record TeamInviteResponse(String id, String email, String name, MemberRole role, String memberId,
        String invitedByName, Instant createdAt, Instant expiresAt, boolean expired, String devLink) {
}
