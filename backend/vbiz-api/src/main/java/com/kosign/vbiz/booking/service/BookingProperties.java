package com.kosign.vbiz.booking.service;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * {@code vbiz.bookings.*}: how long a shop change can be undone, the provider calendar's default
 * range around today, and the booking reminder job.
 */
@ConfigurationProperties("vbiz.bookings")
public record BookingProperties(
        @DefaultValue("PT30S") Duration undoWindow,
        @DefaultValue("60") int pastDays,
        @DefaultValue("90") int futureDays,
        @DefaultValue Reminders reminders) {

    /** The reminder job: on by default, every 5 minutes (tests run it explicitly). */
    public record Reminders(@DefaultValue("true") boolean enabled, @DefaultValue("PT5M") Duration interval) {
    }
}
