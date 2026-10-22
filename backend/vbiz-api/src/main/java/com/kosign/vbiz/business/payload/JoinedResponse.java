package com.kosign.vbiz.business.payload;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.MemberRole;

/** {@code POST /api/me/invites/{token}/accept}: the shop just joined, to open its workspace. */
public record JoinedResponse(String businessId, String businessName, BusinessType businessType, MemberRole role) {
}
