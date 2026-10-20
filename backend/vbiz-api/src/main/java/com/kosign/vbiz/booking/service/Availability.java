package com.kosign.vbiz.booking.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Free start times of a service (docs/api/phase4-bookings-provider.md § Availability). Pure: the
 * caller loads the shop's hours, the staff's shifts and what already holds their time.
 * <p>
 * A member can take a start when the whole service fits their working window on that day (shift
 * clipped to opening hours, no closure), nothing they hold overlaps it — appointments with the
 * shop's buffer on both sides, blocks without — and it is not earlier than the minimum notice.
 */
public final class Availability {

    public static final ZoneId PHNOM_PENH = ZoneId.of("Asia/Phnom_Penh");
    /** The default start-time step (a shop sets its own: {@code BookingSettings.slotMinutes}). */
    public static final int STEP = 30;

    /** Why a requested time cannot be booked ({@code SLOT_UNAVAILABLE} {@code meta.reason}). */
    public enum Reason {
        TAKEN, NOTICE, CLOSED, OUTSIDE, FAR;

        public String code() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }

    /** Something holding a member's time on a date: {@code [start, end)}; {@code buffered} for appointments. */
    public record Busy(UUID staffId, LocalDate date, int start, int end, boolean buffered) {
    }

    /** The shop side: opening hours (Monday first, {@code [open, close]} or null) and closure dates. */
    public record Shop(List<List<Integer>> hours, Set<LocalDate> closures, int bufferMinutes, int minNoticeHours,
            int slotMinutes, int maxDaysAhead) {

        /** 30-minute starts, no booking horizon. */
        public Shop(List<List<Integer>> hours, Set<LocalDate> closures, int bufferMinutes, int minNoticeHours) {
            this(hours, closures, bufferMinutes, minNoticeHours, STEP, Integer.MAX_VALUE);
        }
    }

    public record Slot(int start, List<UUID> staffIds) {
    }

    public record Day(LocalDate date, boolean open, List<Slot> slots) {
    }

    private final Shop shop;
    /** Member id → shifts (null = the shop's hours). Insertion order is the "first available" order. */
    private final Map<UUID, List<List<Integer>>> staff;
    private final Collection<Busy> busy;
    private final Instant now;

    public Availability(Shop shop, Map<UUID, List<List<Integer>>> staff, Collection<Busy> busy, Instant now) {
        this.shop = shop;
        this.staff = staff;
        this.busy = busy;
        this.now = now;
    }

    /**
     * Every {@code slotMinutes} start of the day that fits opening hours, with the members free
     * then. A day past the booking horizon ({@code maxDaysAhead}) is not open for booking.
     */
    public Day day(LocalDate date, int durationMin) {
        int[] open = openOn(date);
        if (open == null || beyondHorizon(date)) {
            return new Day(date, false, List.of());
        }
        List<Slot> slots = new ArrayList<>();
        for (int m = open[0]; m + durationMin <= open[1]; m += shop.slotMinutes()) {
            List<UUID> free = new ArrayList<>();
            for (UUID id : staff.keySet()) {
                if (reason(id, date, m, durationMin) == null) {
                    free.add(id);
                }
            }
            slots.add(new Slot(m, free));
        }
        return new Day(date, true, slots);
    }

    private boolean beyondHorizon(LocalDate date) {
        return shop.maxDaysAhead() != Integer.MAX_VALUE
                && date.isAfter(LocalDate.ofInstant(now, PHNOM_PENH).plusDays(shop.maxDaysAhead()));
    }

    /** Null when {@code staffId} can take the time, else why not. */
    public Reason reason(UUID staffId, LocalDate date, int start, int durationMin) {
        if (beyondHorizon(date)) {
            return Reason.FAR;
        }
        int[] open = openOn(date);
        if (open == null) {
            return Reason.CLOSED;
        }
        int[] window = windowOf(staffId, date, open);
        int end = start + durationMin;
        if (window == null || start < window[0] || end > window[1]) {
            return Reason.OUTSIDE;
        }
        if (instantOf(date, start).isBefore(now.plusSeconds(shop.minNoticeHours() * 3600L))) {
            return Reason.NOTICE;
        }
        int buffer = shop.bufferMinutes();
        for (Busy b : busy) {
            if (!b.staffId().equals(staffId) || !b.date().equals(date)) {
                continue;
            }
            int pad = b.buffered() ? buffer : 0;
            if (start < b.end() + pad && b.start() < end + pad) {
                return Reason.TAKEN;
            }
        }
        return null;
    }

    /**
     * The first member (in {@code staff} order) who can take the time, or the most telling reason
     * none can: {@code TAKEN} wins over {@code OUTSIDE} so "someone works then but is busy" reads
     * as taken.
     */
    public Pick pick(LocalDate date, int start, int durationMin) {
        Reason worst = Reason.OUTSIDE;
        for (UUID id : staff.keySet()) {
            Reason r = reason(id, date, start, durationMin);
            if (r == null) {
                return new Pick(id, null);
            }
            if (r == Reason.CLOSED || r == Reason.NOTICE) {
                return new Pick(null, r);
            }
            if (r == Reason.TAKEN) {
                worst = Reason.TAKEN;
            }
        }
        return new Pick(null, worst);
    }

    public record Pick(UUID staffId, Reason reason) {
    }

    public static Instant instantOf(LocalDate date, int minutes) {
        return date.atStartOfDay(PHNOM_PENH).toInstant().plusSeconds(minutes * 60L);
    }

    private int[] openOn(LocalDate date) {
        if (shop.closures().contains(date)) {
            return null;
        }
        return range(shop.hours(), date);
    }

    private int[] windowOf(UUID staffId, LocalDate date, int[] open) {
        if (!staff.containsKey(staffId)) {
            return null;
        }
        List<List<Integer>> shifts = staff.get(staffId);
        int[] shift = shifts == null ? open : range(shifts, date);
        if (shift == null) {
            return null;
        }
        int from = Math.max(shift[0], open[0]);
        int to = Math.min(shift[1], open[1]);
        return from < to ? new int[] {from, to} : null;
    }

    /** Monday = 0 … Sunday = 6. */
    private static int[] range(List<List<Integer>> week, LocalDate date) {
        if (week == null || week.size() != 7) {
            return null;
        }
        List<Integer> r = week.get(date.getDayOfWeek().getValue() - 1);
        return r == null || r.size() != 2 || r.get(0) == null || r.get(1) == null ? null
                : new int[] {r.get(0), r.get(1)};
    }
}
