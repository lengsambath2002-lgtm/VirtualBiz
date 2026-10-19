package com.kosign.vbiz.common.tenancy;

import java.util.UUID;

/** Implemented by the business domain: is {@code userId} an active member of {@code businessId}? */
public interface TenantMembershipChecker {

    boolean isMember(UUID userId, UUID businessId);
}
