package com.kosign.vbiz.booking.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.kosign.vbiz.booking.domain.AppointmentSource;
import com.kosign.vbiz.booking.domain.AppointmentStatus;

/** {@code Appointment} on the wire (docs/api/phase4-bookings-provider.md § Shapes). */
public record AppointmentResponse(
        String id,
        String number,
        String businessId,
        String clientId,
        ClientRef client,
        String serviceId,
        String serviceName,
        String staffId,
        String date,
        int start,
        int durationMin,
        BigDecimal price,
        AppointmentStatus status,
        AppointmentSource source,
        String note,
        String saleId,
        boolean rescheduled,
        String cancelReason,
        List<LogEntry> log,
        Instant createdAt) {

    public record ClientRef(String id, String name, String phone, String email) {
    }

    public record LogEntry(String code, Map<String, String> params, Instant at) {
    }
}
