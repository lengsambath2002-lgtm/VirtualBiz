package com.kosign.vbiz.booking.payload;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/me/bookings}. {@code service} is the listing slug or id; no {@code staffId} =
 * anyone available. {@code replaces} (a booking number or id) makes it a reschedule.
 */
public record BookingInput(
        @NotBlank @Size(max = 90) String service,
        UUID staffId,
        @NotNull LocalDate date,
        @NotNull @Min(0) @Max(1439) Integer start,
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 20) String phone,
        @Size(max = 200) String note,
        @Size(max = 40) String replaces) {
}
