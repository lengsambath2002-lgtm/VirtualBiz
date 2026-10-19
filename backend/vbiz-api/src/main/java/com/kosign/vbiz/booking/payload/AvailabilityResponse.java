package com.kosign.vbiz.booking.payload;

import java.util.List;

/** Free start times of a service (docs/api/phase4-bookings-provider.md § Availability). */
public record AvailabilityResponse(String serviceId, int durationMin, int step, List<Day> days) {

    public record Day(String date, boolean open, List<Slot> slots) {
    }

    public record Slot(int start, List<String> staffIds) {
    }
}
