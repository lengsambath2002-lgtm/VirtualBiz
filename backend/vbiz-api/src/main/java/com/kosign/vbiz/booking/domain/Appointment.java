package com.kosign.vbiz.booking.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A booked service: one client, one staff member, one time on a Phnom Penh calendar date.
 * {@code customerId} is the account that booked online. Status changes go through
 * {@link AppointmentStatus#transitionTo}; every change appends an {@link AppointmentEvent}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "appointment")
public class Appointment extends BaseEntity {

    @Column(name = "number", length = 12, nullable = false, updatable = false)
    private String number;

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "client_id", nullable = false)
    private UUID clientId;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "service_id", nullable = false)
    private UUID serviceId;

    @Column(name = "staff_id", nullable = false)
    private UUID staffId;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "start_min", nullable = false)
    private int start;

    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    @Column(name = "price", precision = 12, scale = 2, nullable = false)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private AppointmentStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", length = 8, nullable = false, updatable = false)
    private AppointmentSource source;

    @Column(name = "note", length = 200)
    private String note;

    @Column(name = "sale_id")
    private UUID saleId;

    @Column(name = "rescheduled", nullable = false)
    private boolean rescheduled;

    @Column(name = "cancel_reason", length = 40)
    private String cancelReason;

    public int end() {
        return start + durationMin;
    }

    /** What an undo puts back. */
    public AppointmentSnapshot snapshot() {
        return new AppointmentSnapshot(status, serviceId, staffId, date, start, durationMin, price, note, cancelReason);
    }

    public void restore(AppointmentSnapshot s) {
        status = s.status();
        serviceId = s.serviceId();
        staffId = s.staffId();
        date = s.date();
        start = s.start();
        durationMin = s.durationMin();
        price = s.price();
        note = s.note();
        cancelReason = s.cancelReason();
    }
}
