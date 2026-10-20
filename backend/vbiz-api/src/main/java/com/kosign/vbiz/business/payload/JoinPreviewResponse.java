package com.kosign.vbiz.business.payload;

import java.time.Instant;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.MemberRole;

/** {@code GET /api/join/{token}} (public): the shop, the role and whether the email has an account. */
public record JoinPreviewResponse(String businessId, String businessName, BusinessType businessType, String logoUrl, String email,
        String name, MemberRole role, String invitedBy, Instant expiresAt, boolean accountExists,
        boolean accountHasPassword) {
}
