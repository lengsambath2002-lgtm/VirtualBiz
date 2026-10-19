package com.kosign.vbiz.booking.domain;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/**
 * Status of an appointment (docs/db/domain-model.md; the Provider prototype's enum is the source,
 * open question #2; docs/api/phase4-bookings-provider.md § Appointment status). Allowed moves:
 * <ul>
 *   <li>{@code REQUESTED} → {@code BOOKED} (provider accepts), {@code DECLINED}, {@code CANCELLED}</li>
 *   <li>{@code BOOKED} → {@code CONFIRMED} (client confirms), {@code ARRIVED}, {@code CANCELLED}, {@code NO_SHOW}</li>
 *   <li>{@code CONFIRMED} → {@code ARRIVED}, {@code CANCELLED}, {@code NO_SHOW}</li>
 *   <li>{@code ARRIVED} → {@code STARTED}, {@code COMPLETED} (checkout), {@code CANCELLED}, {@code NO_SHOW}</li>
 *   <li>{@code STARTED} → {@code COMPLETED} (checkout)</li>
 *   <li>{@code NO_SHOW} → {@code BOOKED} ("Undo no-show")</li>
 *   <li>{@code COMPLETED}, {@code CANCELLED}, {@code DECLINED} are terminal</li>
 * </ul>
 * Entry points come from {@link #initial(AppointmentSource, boolean)}: online requests start at
 * {@code REQUESTED} (or {@code BOOKED} with auto-confirm), walk-ins at {@code ARRIVED}.
 */
public enum AppointmentStatus {
    REQUESTED,
    BOOKED,
    CONFIRMED,
    ARRIVED,
    STARTED,
    COMPLETED,
    NO_SHOW,
    CANCELLED,
    DECLINED;

    public Set<AppointmentStatus> allowedNext() {
        return switch (this) {
            case REQUESTED -> Collections.unmodifiableSet(EnumSet.of(BOOKED, DECLINED, CANCELLED));
            case BOOKED -> Collections.unmodifiableSet(EnumSet.of(CONFIRMED, ARRIVED, CANCELLED, NO_SHOW));
            case CONFIRMED -> Collections.unmodifiableSet(EnumSet.of(ARRIVED, CANCELLED, NO_SHOW));
            case ARRIVED -> Collections.unmodifiableSet(EnumSet.of(STARTED, COMPLETED, CANCELLED, NO_SHOW));
            case STARTED -> Collections.unmodifiableSet(EnumSet.of(COMPLETED));
            case NO_SHOW -> Collections.unmodifiableSet(EnumSet.of(BOOKED));
            case COMPLETED, CANCELLED, DECLINED -> Collections.emptySet();
        };
    }

    public boolean canTransitionTo(AppointmentStatus target) {
        return target != null && allowedNext().contains(target);
    }

    /** Returns {@code target} or throws {@code INVALID_STATUS_TRANSITION}. */
    public AppointmentStatus transitionTo(AppointmentStatus target) {
        if (!canTransitionTo(target)) {
            throw new BusinessException(StatusCode.INVALID_STATUS_TRANSITION, this, target);
        }
        return target;
    }

    public boolean isTerminal() {
        return allowedNext().isEmpty();
    }

    /** The customer can still cancel or reschedule (subject to the free-cancellation window). */
    public boolean isUpcoming() {
        return this == REQUESTED || this == BOOKED || this == CONFIRMED;
    }

    /** The provider can still edit or move it. */
    public boolean isEditable() {
        return this == REQUESTED || this == BOOKED || this == CONFIRMED || this == ARRIVED;
    }

    /** Holds the staff member's time: everything except the non-completed outcomes. */
    public boolean occupiesSlot() {
        return this != CANCELLED && this != DECLINED && this != NO_SHOW;
    }

    /**
     * First status for a new appointment. Walk-ins start at {@code ARRIVED}. Online requests go
     * to {@code REQUESTED}, or {@code BOOKED} when the shop has auto-confirm on. Phone bookings
     * are entered by the provider, so they are {@code BOOKED} straight away.
     */
    public static AppointmentStatus initial(AppointmentSource source, boolean autoConfirm) {
        return switch (source) {
            case WALK_IN -> ARRIVED;
            case PHONE -> BOOKED;
            case ONLINE -> autoConfirm ? BOOKED : REQUESTED;
        };
    }
}
