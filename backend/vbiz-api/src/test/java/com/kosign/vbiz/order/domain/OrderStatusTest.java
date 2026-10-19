package com.kosign.vbiz.order.domain;

import static com.kosign.vbiz.order.domain.FulfilmentMethod.DELIVERY;
import static com.kosign.vbiz.order.domain.FulfilmentMethod.PICKUP;
import static com.kosign.vbiz.order.domain.OrderStatus.ACCEPTED;
import static com.kosign.vbiz.order.domain.OrderStatus.CANCELLED;
import static com.kosign.vbiz.order.domain.OrderStatus.DELIVERED;
import static com.kosign.vbiz.order.domain.OrderStatus.NEW;
import static com.kosign.vbiz.order.domain.OrderStatus.PACKED;
import static com.kosign.vbiz.order.domain.OrderStatus.PICKED_UP;
import static com.kosign.vbiz.order.domain.OrderStatus.RETURNED;
import static com.kosign.vbiz.order.domain.OrderStatus.SHIPPED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

class OrderStatusTest {

    private static final Instant T0 = Instant.parse("2026-10-09T03:00:00Z");

    @Test
    void transition_table_matches_domain_model() {
        assertThat(NEW.allowedNext()).containsExactlyInAnyOrder(ACCEPTED, CANCELLED);
        assertThat(ACCEPTED.allowedNext()).containsExactly(PACKED);
        assertThat(PACKED.allowedNext()).containsExactlyInAnyOrder(SHIPPED, PICKED_UP);
        assertThat(SHIPPED.allowedNext()).containsExactlyInAnyOrder(DELIVERED, PACKED); // delivery failed -> Ready
        assertThat(DELIVERED.allowedNext()).containsExactly(RETURNED);
        assertThat(PICKED_UP.allowedNext()).containsExactly(RETURNED);
        assertThat(CANCELLED.allowedNext()).isEmpty();
        assertThat(RETURNED.allowedNext()).isEmpty();
    }

    @Test
    void every_status_is_covered_and_terminals_are_cancelled_and_returned() {
        Set<OrderStatus> terminal = EnumSet.noneOf(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) {
            if (s.isTerminal()) {
                terminal.add(s);
            }
        }
        assertThat(terminal).containsExactlyInAnyOrder(CANCELLED, RETURNED);
    }

    @ParameterizedTest
    @EnumSource(OrderStatus.class)
    void no_status_transitions_to_itself_or_back_to_new(OrderStatus s) {
        assertThat(s.canTransitionTo(s)).isFalse();
        assertThat(s.canTransitionTo(NEW)).isFalse();
        assertThat(s.canTransitionTo(null)).isFalse();
    }

    @Test
    void cancel_only_from_new() {
        assertThat(NEW.canTransitionTo(CANCELLED)).isTrue();
        assertThat(ACCEPTED.canTransitionTo(CANCELLED)).isFalse();
        assertThat(PACKED.canTransitionTo(CANCELLED)).isFalse();
        assertThat(SHIPPED.canTransitionTo(CANCELLED)).isFalse();
    }

    @Test
    void delivery_flow() {
        OrderStatus s = NEW;
        for (OrderStatus next : new OrderStatus[] {ACCEPTED, PACKED, SHIPPED, PACKED, SHIPPED, DELIVERED, RETURNED}) {
            s = s.transitionTo(next, DELIVERY);
        }
        assertThat(s).isEqualTo(RETURNED);
        assertThat(PACKED.canTransitionTo(PICKED_UP, DELIVERY)).isFalse();
    }

    @Test
    void pickup_flow_never_ships() {
        assertThat(PACKED.canTransitionTo(PICKED_UP, PICKUP)).isTrue();
        assertThat(PACKED.canTransitionTo(SHIPPED, PICKUP)).isFalse();
        assertThat(SHIPPED.canTransitionTo(DELIVERED, PICKUP)).isFalse();
        assertThat(PICKED_UP.canTransitionTo(RETURNED, PICKUP)).isTrue();
    }

    @Test
    void transitionTo_throws_invalid_status_transition() {
        assertThatThrownBy(() -> NEW.transitionTo(SHIPPED, DELIVERY))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("NEW")
                .hasMessageContaining("SHIPPED")
                .extracting("statusCode").isEqualTo(StatusCode.INVALID_STATUS_TRANSITION);
    }

    @Test
    void customer_may_cancel_while_new_within_five_minutes() {
        assertThat(NEW.customerMayCancel(T0, T0.plus(Duration.ofMinutes(5)))).isTrue();
        assertThat(NEW.customerMayCancel(T0, T0.plus(Duration.ofMinutes(5)).plusSeconds(1))).isFalse();
        assertThat(ACCEPTED.customerMayCancel(T0, T0.plusSeconds(10))).isFalse();
    }

    @Test
    void auto_cancel_after_one_hour_only_when_new() {
        assertThat(NEW.isDueForAutoCancel(T0, T0.plus(Duration.ofMinutes(59)))).isFalse();
        assertThat(NEW.isDueForAutoCancel(T0, T0.plus(Duration.ofHours(1)))).isTrue();
        assertThat(ACCEPTED.isDueForAutoCancel(T0, T0.plus(Duration.ofHours(5)))).isFalse();
    }

    @Test
    void return_within_seven_days_of_fulfilment() {
        assertThat(DELIVERED.mayReturn(T0, T0.plus(Duration.ofDays(7)))).isTrue();
        assertThat(DELIVERED.mayReturn(T0, T0.plus(Duration.ofDays(7)).plusSeconds(1))).isFalse();
        assertThat(PICKED_UP.mayReturn(T0, T0.plus(Duration.ofDays(1)))).isTrue();
        assertThat(SHIPPED.mayReturn(T0, T0.plus(Duration.ofDays(1)))).isFalse();
        assertThat(DELIVERED.mayReturn(null, T0)).isFalse();
    }
}
