package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.Instant;

import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.VerificationStatus;

/** A shop in the admin list, with its owner and last 30 days of sales. */
public record AdminBusinessRow(
        String id,
        String name,
        String slug,
        BusinessType type,
        String categoryId,
        String district,
        String logoUrl,
        String ownerId,
        String ownerName,
        String ownerContact,
        VerificationStatus verification,
        boolean hasIdPhoto,
        boolean online,
        Instant suspendedAt,
        double rating,
        int reviewCount,
        long orders30,
        BigDecimal gmv30,
        Instant createdAt) {
}
