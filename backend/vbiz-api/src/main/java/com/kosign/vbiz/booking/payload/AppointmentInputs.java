package com.kosign.vbiz.booking.payload;

import java.time.LocalDate;
import java.util.UUID;

import com.kosign.vbiz.booking.domain.AppointmentSource;
import com.kosign.vbiz.booking.domain.AppointmentStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Bodies of the provider's appointment calls (docs/api/phase4-bookings-provider.md § Appointments). */
public final class AppointmentInputs {

    private AppointmentInputs() {
    }

    /** A new client typed into the appointment form. */
    public record NewClient(@Size(max = 80) String name, @Size(max = 20) String phone, @Size(max = 254) String email) {
    }

    public record Create(
            UUID clientId,
            @Valid NewClient client,
            @NotNull UUID serviceId,
            @NotNull UUID staffId,
            @NotNull LocalDate date,
            @NotNull @Min(0) @Max(1439) Integer start,
            @NotNull AppointmentSource source,
            @Size(max = 200) String note) {
    }

    /** Only the fields present change; an empty {@code note} clears it. */
    public record Patch(
            UUID serviceId,
            UUID staffId,
            LocalDate date,
            @Min(0) @Max(1439) Integer start,
            @Size(max = 200) String note) {
    }

    /** {@code message}: what the shop says to the client when declining (shown to them; optional). */
    public record Status(@NotNull AppointmentStatus status, @Size(max = 30) String reason,
            @Size(max = 300) String message) {
    }

    /** {@code POST /api/appointments/bulk-status}: one status change for several appointments. */
    public record BulkStatus(@jakarta.validation.constraints.NotEmpty
            @jakarta.validation.constraints.Size(max = 100) java.util.List<String> refs,
            @jakarta.validation.constraints.NotNull @jakarta.validation.Valid Status status) {
    }
}
