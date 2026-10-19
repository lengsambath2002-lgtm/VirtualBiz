package com.kosign.vbiz.booking.domain;

import static com.kosign.vbiz.booking.domain.AppointmentStatus.ARRIVED;
import static com.kosign.vbiz.booking.domain.AppointmentStatus.BOOKED;
import static com.kosign.vbiz.booking.domain.AppointmentStatus.CANCELLED;
import static com.kosign.vbiz.booking.domain.AppointmentStatus.COMPLETED;
import static com.kosign.vbiz.booking.domain.AppointmentStatus.CONFIRMED;
import static com.kosign.vbiz.booking.domain.AppointmentStatus.DECLINED;
import static com.kosign.vbiz.booking.domain.AppointmentStatus.NO_SHOW;
import static com.kosign.vbiz.booking.domain.AppointmentStatus.REQUESTED;
import static com.kosign.vbiz.booking.domain.AppointmentStatus.STARTED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

class AppointmentStatusTest {

    @Test
    void transition_table() {
        assertThat(REQUESTED.allowedNext()).containsExactlyInAnyOrder(BOOKED, DECLINED, CANCELLED);
        assertThat(BOOKED.allowedNext()).containsExactlyInAnyOrder(CONFIRMED, ARRIVED, CANCELLED, NO_SHOW);
        assertThat(CONFIRMED.allowedNext()).containsExactlyInAnyOrder(ARRIVED, CANCELLED, NO_SHOW);
        assertThat(ARRIVED.allowedNext()).containsExactlyInAnyOrder(STARTED, COMPLETED, CANCELLED, NO_SHOW);
        assertThat(STARTED.allowedNext()).containsExactly(COMPLETED);
        assertThat(NO_SHOW.allowedNext()).containsExactly(BOOKED);
    }

    @ParameterizedTest
    @EnumSource(value = AppointmentStatus.class, names = {"COMPLETED", "CANCELLED", "DECLINED"})
    void terminal_statuses(AppointmentStatus s) {
        assertThat(s.isTerminal()).isTrue();
        assertThat(s.allowedNext()).isEmpty();
    }

    @ParameterizedTest
    @EnumSource(AppointmentStatus.class)
    void never_back_to_requested_or_to_self(AppointmentStatus s) {
        assertThat(s.canTransitionTo(REQUESTED)).isFalse();
        assertThat(s.canTransitionTo(s)).isFalse();
        assertThat(s.canTransitionTo(null)).isFalse();
    }

    @Test
    void decline_only_from_requested() {
        for (AppointmentStatus s : AppointmentStatus.values()) {
            assertThat(s.canTransitionTo(DECLINED)).as(s + " -> DECLINED").isEqualTo(s == REQUESTED);
        }
    }

    @Test
    void no_show_until_started_and_undoable() {
        assertThat(BOOKED.canTransitionTo(NO_SHOW)).isTrue();
        assertThat(CONFIRMED.canTransitionTo(NO_SHOW)).isTrue();
        assertThat(ARRIVED.canTransitionTo(NO_SHOW)).isTrue();
        assertThat(REQUESTED.canTransitionTo(NO_SHOW)).isFalse();
        assertThat(STARTED.canTransitionTo(NO_SHOW)).isFalse();
        assertThat(NO_SHOW.canTransitionTo(BOOKED)).isTrue();
    }

    @Test
    void checkout_completes_from_arrived_or_started_only() {
        for (AppointmentStatus s : AppointmentStatus.values()) {
            assertThat(s.canTransitionTo(COMPLETED)).as(s + " -> COMPLETED")
                    .isEqualTo(s == ARRIVED || s == STARTED);
        }
    }

    @Test
    void upcoming_and_editable() {
        assertThat(java.util.Arrays.stream(AppointmentStatus.values()).filter(AppointmentStatus::isUpcoming))
                .containsExactly(REQUESTED, BOOKED, CONFIRMED);
        assertThat(java.util.Arrays.stream(AppointmentStatus.values()).filter(AppointmentStatus::isEditable))
                .containsExactly(REQUESTED, BOOKED, CONFIRMED, ARRIVED);
    }

    @Test
    void full_happy_path() {
        AppointmentStatus s = REQUESTED;
        for (AppointmentStatus next : new AppointmentStatus[] {BOOKED, CONFIRMED, ARRIVED, STARTED, COMPLETED}) {
            s = s.transitionTo(next);
        }
        assertThat(s).isEqualTo(COMPLETED);
    }

    @Test
    void transitionTo_throws_invalid_status_transition() {
        assertThatThrownBy(() -> COMPLETED.transitionTo(CANCELLED))
                .isInstanceOf(BusinessException.class)
                .extracting("statusCode").isEqualTo(StatusCode.INVALID_STATUS_TRANSITION);
        assertThatThrownBy(() -> REQUESTED.transitionTo(STARTED)).isInstanceOf(BusinessException.class);
    }

    @Test
    void initial_status_by_source() {
        assertThat(AppointmentStatus.initial(AppointmentSource.ONLINE, false)).isEqualTo(REQUESTED);
        assertThat(AppointmentStatus.initial(AppointmentSource.ONLINE, true)).isEqualTo(BOOKED);
        assertThat(AppointmentStatus.initial(AppointmentSource.WALK_IN, false)).isEqualTo(ARRIVED);
        assertThat(AppointmentStatus.initial(AppointmentSource.PHONE, false)).isEqualTo(BOOKED);
    }

    @Test
    void occupies_slot() {
        assertThat(BOOKED.occupiesSlot()).isTrue();
        assertThat(COMPLETED.occupiesSlot()).isTrue();
        assertThat(CANCELLED.occupiesSlot()).isFalse();
        assertThat(DECLINED.occupiesSlot()).isFalse();
        assertThat(NO_SHOW.occupiesSlot()).isFalse();
    }
}
