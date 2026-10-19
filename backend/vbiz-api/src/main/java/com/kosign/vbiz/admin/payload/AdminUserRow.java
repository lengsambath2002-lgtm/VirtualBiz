package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.Instant;

import com.kosign.vbiz.account.domain.PlatformRole;

/** An account in the admin list. */
public record AdminUserRow(
        String id,
        String name,
        String email,
        String phone,
        String avatarUrl,
        PlatformRole platformRole,
        Instant suspendedAt,
        long orders,
        BigDecimal spent,
        long businesses,
        Instant createdAt) {
}
