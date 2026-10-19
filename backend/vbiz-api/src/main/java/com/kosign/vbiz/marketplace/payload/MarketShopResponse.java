package com.kosign.vbiz.marketplace.payload;

import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.business.domain.BookingSettings;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.Closure;
import com.kosign.vbiz.business.domain.ProductSettings;

/** {@code MarketShop}: a shop as customers see it. */
public record MarketShopResponse(
        String id,
        String slug,
        BusinessType type,
        String name,
        String categoryId,
        String icon,
        int tint,
        String about,
        String logoUrl,
        String coverUrl,
        String phone,
        String district,
        String street,
        Double lat,
        Double lng,
        List<List<Integer>> hours,
        List<Closure> closures,
        double rating,
        int reviewCount,
        Instant since,
        Integer replyMinutes,
        List<Integer> etaMinutes,
        boolean openNow,
        Double distanceKm,
        List<StaffRef> staff,
        ProductSettings productSettings,
        BookingSettings bookingSettings) {
}
