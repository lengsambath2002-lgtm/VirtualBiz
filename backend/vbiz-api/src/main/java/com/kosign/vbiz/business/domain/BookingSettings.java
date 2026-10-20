package com.kosign.vbiz.business.domain;

import java.util.List;

/** Settings of a {@code SERVICE} business (Service Provider workspace). Stored as JSONB. */
public record BookingSettings(
        Boolean onlineBooking,
        Boolean autoConfirm,
        Integer reminderHours,
        Integer minNoticeHours,
        Integer freeCancelHours,
        Integer bufferMinutes,
        /** Start times are offered every this many minutes (5–60). */
        Integer slotMinutes,
        /** How many days ahead clients can book online (1–180; default 90). */
        Integer maxDaysAhead,
        /** Tip choices at checkout, in percent (up to 5, each 0–50). */
        List<Integer> tipPresets) {

    /** The settings before slot interval, horizon and tips existed (their defaults apply). */
    public BookingSettings(Boolean onlineBooking, Boolean autoConfirm, Integer reminderHours, Integer minNoticeHours,
            Integer freeCancelHours, Integer bufferMinutes) {
        this(onlineBooking, autoConfirm, reminderHours, minNoticeHours, freeCancelHours, bufferMinutes, null, null,
                null);
    }

    /** Defaults for a new provider (Create Business); reminder 24 h per open question #3. */
    public static BookingSettings defaults() {
        return new BookingSettings(true, false, 24, 2, 2, 0, 30, 90, List.of(0, 5, 10, 15));
    }
}
