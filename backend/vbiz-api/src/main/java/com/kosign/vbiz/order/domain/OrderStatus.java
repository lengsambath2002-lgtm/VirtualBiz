package com.kosign.vbiz.order.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.EnumSet;
import java.util.Set;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/**
 * Status of one shop's order (docs/db/domain-model.md). Flow:
 * <pre>
 * NEW ──accept──▶ ACCEPTED ──pack──▶ PACKED ──hand over──▶ SHIPPED ──▶ DELIVERED ──return──▶ RETURNED
 *  │                                   │  ▲                   │
 *  │                                   │  └──delivery failed──┘
 *  │                                   └──customer collects──▶ PICKED_UP ──return──▶ RETURNED
 *  └──reject / customer cancel / auto-cancel (1 h)──▶ CANCELLED
 * </pre>
 * {@code SHIPPED} is only for {@link FulfilmentMethod#DELIVERY}, {@code PICKED_UP} only for
 * {@link FulfilmentMethod#PICKUP}. Time windows are separate checks (see the {@code *_WINDOW}
 * constants) because they depend on the clock and on who is acting.
 */
public enum OrderStatus {
    NEW,
    ACCEPTED,
    PACKED,
    SHIPPED,
    DELIVERED,
    PICKED_UP,
    CANCELLED,
    RETURNED;

    /** An order still {@code NEW} after this long is auto-cancelled. */
    public static final Duration AUTO_CANCEL_AFTER = Duration.ofHours(1);

    /** The customer may cancel while {@code NEW} and within this long of placing the order. */
    public static final Duration CUSTOMER_CANCEL_WINDOW = Duration.ofMinutes(5);

    /** Returns are allowed within this long of delivery (or pickup). */
    public static final Duration RETURN_WINDOW = Duration.ofDays(7);

    /** Statuses reachable from this one for any fulfilment method. */
    public Set<OrderStatus> allowedNext() {
        return switch (this) {
            case NEW -> Collections.unmodifiableSet(EnumSet.of(ACCEPTED, CANCELLED));
            case ACCEPTED -> Collections.unmodifiableSet(EnumSet.of(PACKED));
            case PACKED -> Collections.unmodifiableSet(EnumSet.of(SHIPPED, PICKED_UP));
            case SHIPPED -> Collections.unmodifiableSet(EnumSet.of(DELIVERED, PACKED));
            case DELIVERED, PICKED_UP -> Collections.unmodifiableSet(EnumSet.of(RETURNED));
            case CANCELLED, RETURNED -> Collections.emptySet();
        };
    }

    public boolean canTransitionTo(OrderStatus target) {
        return target != null && allowedNext().contains(target);
    }

    /** Like {@link #canTransitionTo(OrderStatus)} but also enforces the fulfilment method. */
    public boolean canTransitionTo(OrderStatus target, FulfilmentMethod method) {
        if (!canTransitionTo(target)) {
            return false;
        }
        if (method == FulfilmentMethod.PICKUP && target == SHIPPED) {
            return false;
        }
        if (method == FulfilmentMethod.DELIVERY && target == PICKED_UP) {
            return false;
        }
        // A pickup order never leaves the shop, so it can never come back from SHIPPED.
        return !(method == FulfilmentMethod.PICKUP && this == SHIPPED);
    }

    /** Returns {@code target} or throws {@code INVALID_STATUS_TRANSITION}. */
    public OrderStatus transitionTo(OrderStatus target, FulfilmentMethod method) {
        if (!canTransitionTo(target, method)) {
            throw new BusinessException(StatusCode.INVALID_STATUS_TRANSITION, this, target);
        }
        return target;
    }

    public boolean isTerminal() {
        return allowedNext().isEmpty();
    }

    /** True for statuses where the customer has received the goods. */
    public boolean isFulfilled() {
        return this == DELIVERED || this == PICKED_UP;
    }

    /** Customer self-cancel: only while {@code NEW} and within {@link #CUSTOMER_CANCEL_WINDOW}. */
    public boolean customerMayCancel(Instant placedAt, Instant now) {
        return this == NEW && !now.isAfter(placedAt.plus(CUSTOMER_CANCEL_WINDOW));
    }

    /** Auto-cancel job: {@code NEW} orders older than {@link #AUTO_CANCEL_AFTER}. */
    public boolean isDueForAutoCancel(Instant placedAt, Instant now) {
        return this == NEW && !now.isBefore(placedAt.plus(AUTO_CANCEL_AFTER));
    }

    /** Return: only once fulfilled and within {@link #RETURN_WINDOW} of fulfilment. */
    public boolean mayReturn(Instant fulfilledAt, Instant now) {
        return isFulfilled() && fulfilledAt != null && !now.isAfter(fulfilledAt.plus(RETURN_WINDOW));
    }
}
