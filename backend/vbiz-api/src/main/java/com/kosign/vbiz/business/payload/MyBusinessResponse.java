package com.kosign.vbiz.business.payload;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.domain.VerificationStatus;

/** {@code MyBusiness}: a business the user belongs to, and their role in it ({@code logoUrl} when uploaded). */
public record MyBusinessResponse(String id, String name, BusinessType type, MemberRole role,
        VerificationStatus verification, String logoUrl) {
}
