package com.kosign.vbiz.booking.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** The fields a shop change can alter, stored on its event so Undo can put them back. */
public record AppointmentSnapshot(
        AppointmentStatus status,
        UUID serviceId,
        UUID staffId,
        LocalDate date,
        int start,
        int durationMin,
        BigDecimal price,
        String note,
        String cancelReason) {
}
