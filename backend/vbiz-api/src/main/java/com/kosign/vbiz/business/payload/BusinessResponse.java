package com.kosign.vbiz.business.payload;

import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.business.domain.BookingSettings;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.Closure;
import com.kosign.vbiz.business.domain.ProductSettings;
import com.kosign.vbiz.business.domain.VerificationStatus;

/** {@code Business} on the wire (docs/db/domain-model.md). One of the two settings is set, by type. */
public record BusinessResponse(
        String id,
        String ownerId,
        BusinessType type,
        String name,
        String slug,
        String categoryId,
        String about,
        String phone,
        String email,
        String district,
        String street,
        Double lat,
        Double lng,
        List<List<Integer>> hours,
        List<Closure> closures,
        boolean online,
        String logoUrl,
        String coverUrl,
        String bakongId,
        VerificationStatus verification,
        /** Why the ID check failed (REJECTED only). */
        String verificationNote,
        /** Set while VirtualBiz has suspended the shop, with the reason the owner sees. */
        Instant suspendedAt,
        String suspendedReason,
        double rating,
        int reviewCount,
        Instant since,
        ProductSettings productSettings,
        BookingSettings bookingSettings) {
}
