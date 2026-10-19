package com.kosign.vbiz.business.domain;

/** Settings of a {@code SERVICE} business (Service Provider workspace). Stored as JSONB. */
public record BookingSettings(
        Boolean onlineBooking,
        Boolean autoConfirm,
        Integer reminderHours,
        Integer minNoticeHours,
        Integer freeCancelHours,
        Integer bufferMinutes) {

    /** Defaults for a new provider (Create Business); reminder 24 h per open question #3. */
    public static BookingSettings defaults() {
        return new BookingSettings(true, false, 24, 2, 2, 0);
    }
}
