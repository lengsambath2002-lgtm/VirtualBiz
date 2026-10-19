package com.kosign.vbiz.common.tenancy;

import java.util.Optional;
import java.util.UUID;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/**
 * The business a merchant request acts for. Set per request by {@link TenancyFilter} after
 * checking the user is a member; cleared when the request ends. Customer requests have no
 * business and are scoped to the user instead.
 */
public final class TenantContext {

    private static final ThreadLocal<UUID> businessId = new ThreadLocal<>();

    private TenantContext() {
    }

    public static Optional<UUID> getBusinessId() {
        return Optional.ofNullable(businessId.get());
    }

    /** For merchant-only code paths: throws {@code BUSINESS_CONTEXT_REQUIRED} when unset. */
    public static UUID requireBusinessId() {
        UUID id = businessId.get();
        if (id == null) {
            throw new BusinessException(StatusCode.BUSINESS_CONTEXT_REQUIRED);
        }
        return id;
    }

    public static void set(UUID id) {
        businessId.set(id);
    }

    public static void clear() {
        businessId.remove();
    }
}
