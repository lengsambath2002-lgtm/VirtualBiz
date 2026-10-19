package com.kosign.vbiz.booking;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.kosign.vbiz.booking.service.Availability;
import com.kosign.vbiz.booking.service.Availability.Busy;
import com.kosign.vbiz.booking.service.Availability.Reason;

class AvailabilityTest {

    /** Monday 2026-10-19; the shop opens 8:00–18:00 Monday to Saturday. */
    static final LocalDate MON = LocalDate.parse("2026-10-19");
    static final LocalDate SUN = LocalDate.parse("2026-10-25");
    static final List<List<Integer>> HOURS = week(List.of(480, 1080), List.of(480, 1080), List.of(480, 1080),
            List.of(480, 1080), List.of(480, 1080), List.of(480, 1080), null);
    /** Long before MON, so the minimum notice never matters unless a test says so. */
    static final Instant EARLY = Instant.parse("2026-10-01T00:00:00Z");

    final UUID dana = UUID.randomUUID();
    final UUID leak = UUID.randomUUID();

    @Test
    void slots_every_30_minutes_while_the_service_fits() {
        Availability a = new Availability(shop(Set.of(), 0, 0), staff(dana, null), List.of(), EARLY);
        Availability.Day day = a.day(MON, 45);
        assertThat(day.open()).isTrue();
        assertThat(day.slots()).first().extracting(Availability.Slot::start).isEqualTo(480);
        // 17:30 + 45 min runs past 18:00, so the last start is 17:00.
        assertThat(day.slots()).last().extracting(Availability.Slot::start).isEqualTo(1020);
        assertThat(day.slots()).allSatisfy(s -> assertThat(s.staffIds()).containsExactly(dana));
    }

    @Test
    void closed_days_and_closures_have_no_slots() {
        Availability a = new Availability(shop(Set.of(MON), 0, 0), staff(dana, null), List.of(), EARLY);
        assertThat(a.day(MON, 30).open()).isFalse();
        assertThat(a.day(SUN, 30).open()).isFalse();
        assertThat(a.reason(dana, MON, 600, 30)).isEqualTo(Reason.CLOSED);
    }

    @Test
    void shift_is_clipped_to_opening_hours() {
        // Leak works 9:00–20:00 on Monday; the shop closes at 18:00.
        Availability a = new Availability(shop(Set.of(), 0, 0),
                staff(leak, week(List.of(540, 1200), null, null, null, null, null, null)), List.of(), EARLY);
        assertThat(a.reason(leak, MON, 510, 30)).isEqualTo(Reason.OUTSIDE);
        assertThat(a.reason(leak, MON, 540, 30)).isNull();
        assertThat(a.reason(leak, MON, 1050, 60)).isEqualTo(Reason.OUTSIDE);
        assertThat(a.reason(leak, MON.plusDays(1), 600, 30)).isEqualTo(Reason.OUTSIDE);
    }

    @Test
    void appointments_block_with_the_buffer_and_blocks_without() {
        List<Busy> busy = List.of(new Busy(dana, MON, 600, 660, true), new Busy(dana, MON, 720, 780, false));
        Availability a = new Availability(shop(Set.of(), 15, 0), staff(dana, null), busy, EARLY);
        assertThat(a.reason(dana, MON, 630, 30)).isEqualTo(Reason.TAKEN);
        // 10:00–11:00 is booked; with a 15-minute buffer 11:00 is too close, 11:15 is fine.
        assertThat(a.reason(dana, MON, 660, 30)).isEqualTo(Reason.TAKEN);
        assertThat(a.reason(dana, MON, 675, 30)).isNull();
        // The lunch block 12:00–13:00 has no buffer: 11:30–12:00 and 13:00 are fine.
        assertThat(a.reason(dana, MON, 690, 30)).isNull();
        assertThat(a.reason(dana, MON, 780, 30)).isNull();
        assertThat(a.reason(dana, MON, 750, 30)).isEqualTo(Reason.TAKEN);
    }

    @Test
    void minimum_notice() {
        // Monday 10:00 Phnom Penh = 03:00 UTC; 2 h notice → nothing before 12:00.
        Availability a = new Availability(shop(Set.of(), 0, 2), staff(dana, null), List.of(),
                Instant.parse("2026-10-19T03:00:00Z"));
        assertThat(a.reason(dana, MON, 690, 30)).isEqualTo(Reason.NOTICE);
        assertThat(a.reason(dana, MON, 720, 30)).isNull();
        assertThat(a.day(MON, 30).slots().stream().filter(s -> !s.staffIds().isEmpty()).findFirst())
                .get().extracting(Availability.Slot::start).isEqualTo(720);
    }

    @Test
    void pick_takes_the_first_free_member_in_order() {
        Map<UUID, List<List<Integer>>> both = new LinkedHashMap<>();
        both.put(dana, null);
        both.put(leak, null);
        Availability a = new Availability(shop(Set.of(), 0, 0), both, List.of(new Busy(dana, MON, 600, 660, true)),
                EARLY);
        assertThat(a.pick(MON, 540, 30).staffId()).isEqualTo(dana);
        assertThat(a.pick(MON, 600, 30).staffId()).isEqualTo(leak);
        Availability full = new Availability(shop(Set.of(), 0, 0), both,
                List.of(new Busy(dana, MON, 600, 660, true), new Busy(leak, MON, 600, 660, false)), EARLY);
        assertThat(full.pick(MON, 600, 30)).extracting(Availability.Pick::reason).isEqualTo(Reason.TAKEN);
        assertThat(full.pick(SUN, 600, 30)).extracting(Availability.Pick::reason).isEqualTo(Reason.CLOSED);
    }

    @Test
    void a_member_with_no_shifts_works_the_shop_hours() {
        Availability a = new Availability(shop(Set.of(), 0, 0), staff(dana, null), List.of(), EARLY);
        assertThat(a.reason(dana, MON, 480, 600)).isNull();
        assertThat(a.reason(UUID.randomUUID(), MON, 600, 30)).isEqualTo(Reason.OUTSIDE);
    }

    private static Availability.Shop shop(Set<LocalDate> closures, int buffer, int notice) {
        return new Availability.Shop(HOURS, closures, buffer, notice);
    }

    private static Map<UUID, List<List<Integer>>> staff(UUID id, List<List<Integer>> shifts) {
        Map<UUID, List<List<Integer>>> m = new LinkedHashMap<>();
        m.put(id, shifts);
        return m;
    }

    @SafeVarargs
    private static List<List<Integer>> week(List<Integer>... days) {
        return new ArrayList<>(java.util.Arrays.asList(days));
    }
}
