package com.kosign.vbiz.business.mapper;

import java.math.BigDecimal;

import com.kosign.vbiz.business.domain.BookingSettings;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.ShopPolicy;
import com.kosign.vbiz.business.domain.VerificationStatus;
import com.kosign.vbiz.business.payload.BusinessResponse;
import com.kosign.vbiz.business.payload.MemberResponse;
import com.kosign.vbiz.business.payload.MyBusinessResponse;
import com.kosign.vbiz.catalog.service.CatalogStarters;

/** Entity → payload for the business domain. */
public final class BusinessMapper {

    private BusinessMapper() {
    }

    public static BusinessResponse toResponse(Business b) {
        return new BusinessResponse(
                b.getId().toString(), b.getOwnerId().toString(), b.getType(), b.getName(), b.getSlug(),
                b.getCategoryId(), b.getAbout(), b.getPhone(), b.getEmail(), b.getDistrict(), b.getStreet(),
                toDouble(b.getLat()), toDouble(b.getLng()), b.getHours(), b.getClosures(), b.isOnline(),
                b.getLogoUrl(), b.getCoverUrl(), b.getBakongId(), b.getVerification(),
                b.getVerification() == VerificationStatus.REJECTED ? b.getVerificationNote() : null,
                b.getSuspendedAt(), b.getSuspendedReason(),
                b.getRating() == null ? 0 : b.getRating().doubleValue(), b.getReviewCount(), b.getSince(),
                b.getProductSettings(), withCategories(b), ShopPolicy.of(b.getPolicy()));
    }

    public static MyBusinessResponse toMine(BusinessMember m, Business b) {
        return new MyBusinessResponse(b.getId().toString(), b.getName(), b.getType(), m.getRole(), b.getVerification(),
                b.getLogoUrl());
    }

    public static MemberResponse toMember(BusinessMember m) {
        return toMember(m, null);
    }

    /** With the login's email (team page). */
    public static MemberResponse toMember(BusinessMember m, String email) {
        return new MemberResponse(m.getId().toString(), m.getBusinessId().toString(),
                m.getUserId() == null ? null : m.getUserId().toString(), m.getName(), m.getRole(),
                m.getTitle(), m.getColor(), m.getShifts(), m.isActive(), email);
    }

    /** A provider's booking settings with its service categories (the starters until it sets its own). */
    private static BookingSettings withCategories(Business b) {
        BookingSettings s = b.getBookingSettings();
        if (b.getType() != BusinessType.SERVICE || s == null || s.serviceCategories() != null) {
            return s;
        }
        return new BookingSettings(s.onlineBooking(), s.autoConfirm(), s.reminderHours(), s.minNoticeHours(),
                s.freeCancelHours(), s.bufferMinutes(), s.slotMinutes(), s.maxDaysAhead(), s.tipPresets(),
                CatalogStarters.serviceCategories(b.getCategoryId()));
    }

    private static Double toDouble(BigDecimal v) {
        return v == null ? null : v.doubleValue();
    }
}
