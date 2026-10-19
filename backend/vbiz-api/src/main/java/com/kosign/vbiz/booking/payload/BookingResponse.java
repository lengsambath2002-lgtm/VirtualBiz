package com.kosign.vbiz.booking.payload;

import java.math.BigDecimal;
import java.time.Instant;

import com.kosign.vbiz.booking.domain.AppointmentStatus;

/** The customer's view of an appointment ({@code Booking}, docs/api/phase4-bookings-provider.md § Bookings). */
public record BookingResponse(
        String id,
        String number,
        AppointmentStatus status,
        boolean rescheduled,
        String cancelReason,
        ServiceRef service,
        ShopRef shop,
        StaffRef staff,
        String date,
        int start,
        int durationMin,
        BigDecimal price,
        String note,
        Instant createdAt,
        Instant freeCancelUntil,
        boolean canChange) {

    public record ServiceRef(String id, String slug, String name) {
    }

    public record ShopRef(String id, String slug, String name, String phone, String street, String district) {
    }

    public record StaffRef(String id, String name) {
    }
}
