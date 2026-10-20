package com.kosign.vbiz.booking.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.domain.AppointmentSource;
import com.kosign.vbiz.booking.domain.AppointmentStatus;
import com.kosign.vbiz.booking.domain.CalendarBlock;
import com.kosign.vbiz.booking.payload.AvailabilityResponse;
import com.kosign.vbiz.booking.payload.BookingInput;
import com.kosign.vbiz.booking.payload.BookingResponse;
import com.kosign.vbiz.booking.repository.AppointmentRepository;
import com.kosign.vbiz.booking.repository.CalendarBlockRepository;
import com.kosign.vbiz.business.domain.BookingSettings;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.business.service.MembershipService;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.customer.domain.Client;
import com.kosign.vbiz.customer.service.ClientService;

import lombok.RequiredArgsConstructor;

/**
 * The customer's side of bookings (docs/api/phase4-bookings-provider.md § Customer): free times,
 * booking, rescheduling and cancelling, and the "My bookings" list.
 */
@Service
@RequiredArgsConstructor
public class BookingService {

    /** Statuses that hold a member's time for online availability (requests included). */
    static final Set<AppointmentStatus> HOLDING = EnumSet.of(AppointmentStatus.REQUESTED, AppointmentStatus.BOOKED,
            AppointmentStatus.CONFIRMED, AppointmentStatus.ARRIVED, AppointmentStatus.STARTED,
            AppointmentStatus.COMPLETED);
    static final int MAX_DAYS = 14;

    private final AppointmentRepository appointments;
    private final CalendarBlockRepository blocks;
    private final AppointmentService calendar;
    private final AppointmentViews views;
    private final BookingNotifier notifier;
    private final BookingRules rules;
    private final ClientService clients;
    private final ServiceItemRepository services;
    private final BusinessRepository businesses;
    private final MembershipService membership;
    private final UserRepository users;
    private final Clock clock;

    // ── Availability (public) ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AvailabilityResponse availability(String ref, LocalDate from, Integer days, UUID staffId) {
        ServiceItem s = listedService(ref);
        Business b = businesses.findById(s.getBusinessId())
                .orElseThrow(() -> new BusinessException(StatusCode.LISTING_NOT_FOUND));
        LocalDate first = from == null ? calendar.today() : from;
        int n = days == null ? 7 : days;
        if (n < 1 || n > MAX_DAYS) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "days", "1–" + MAX_DAYS);
        }
        LocalDate last = first.plusDays(n - 1L);
        Map<UUID, List<List<Integer>>> staff = bookable(b, s) ? staffOf(b, s, staffId) : Map.of();
        Availability av = availabilityOf(b, staff, first, last, null);
        List<AvailabilityResponse.Day> out = new ArrayList<>();
        for (LocalDate d = first; !d.isAfter(last); d = d.plusDays(1)) {
            Availability.Day day = av.day(d, s.getDurationMin());
            out.add(new AvailabilityResponse.Day(d.toString(), day.open(), day.slots().stream()
                    .map(x -> new AvailabilityResponse.Slot(x.start(),
                            x.staffIds().stream().map(UUID::toString).toList()))
                    .toList()));
        }
        return new AvailabilityResponse(s.getId().toString(), s.getDurationMin(), rules.shop(b).slotMinutes(), out);
    }

    // ── Bookings (signed in) ──────────────────────────────────────────────────────────

    @Transactional
    public BookingResponse book(UUID userId, BookingInput in) {
        ServiceItem s = listedService(in.service());
        Business b = businesses.findById(s.getBusinessId())
                .orElseThrow(() -> new BusinessException(StatusCode.LISTING_NOT_FOUND));
        if (!bookable(b, s)) {
            throw new BusinessException(StatusCode.BOOKING_UNAVAILABLE);
        }
        AppointmentService.requireFits(in.start(), s.getDurationMin());
        appointments.lockBusiness(b.getId().getMostSignificantBits() ^ b.getId().getLeastSignificantBits());
        Instant now = clock.instant();

        Appointment old = null;
        if (in.replaces() != null && !in.replaces().isBlank()) {
            old = calendar.lock(mine(userId, in.replaces()).getId());
            requireChangeable(old, now);
        }

        Map<UUID, List<List<Integer>>> staff = staffOf(b, s, in.staffId());
        if (in.staffId() != null && staff.isEmpty()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "staffId",
                    "Not someone who performs this service");
        }
        Availability av = availabilityOf(b, staff, in.date(), in.date(), old == null ? null : old.getId());
        Availability.Pick pick = in.staffId() != null
                ? new Availability.Pick(in.staffId(), av.reason(in.staffId(), in.date(), in.start(), s.getDurationMin()))
                : av.pick(in.date(), in.start(), s.getDurationMin());
        if (pick.reason() != null || pick.staffId() == null) {
            Availability.Reason r = pick.reason() == null ? Availability.Reason.TAKEN : pick.reason();
            throw BusinessException.withDetail(StatusCode.SLOT_UNAVAILABLE, "start", "That time is not available",
                    Map.of("reason", r.code()));
        }

        User u = users.findById(userId).orElse(null);
        Client c = clients.findOrCreate(b.getId(), userId, in.name(), in.phone(), u == null ? null : u.getEmail());
        BookingSettings settings = rules.settings(b);
        Appointment a = new Appointment();
        a.setNumber(calendar.nextNumber());
        a.setBusinessId(b.getId());
        a.setClientId(c.getId());
        a.setCustomerId(userId);
        a.setServiceId(s.getId());
        a.setStaffId(pick.staffId());
        a.setDate(in.date());
        a.setStart(in.start());
        a.setDurationMin(s.getDurationMin());
        a.setPrice(netPrice(s));
        a.setSource(AppointmentSource.ONLINE);
        a.setStatus(AppointmentStatus.initial(AppointmentSource.ONLINE, Boolean.TRUE.equals(settings.autoConfirm())));
        a.setNote(in.note() == null || in.note().isBlank() ? null : in.note().trim());
        a = appointments.saveAndFlush(a);
        calendar.log(a, "bookedOnline", Map.of(), null, userId);

        if (old != null) {
            old.setStatus(old.getStatus().transitionTo(AppointmentStatus.CANCELLED));
            old.setRescheduled(true);
            old.setCancelReason("rescheduled");
            calendar.log(old, "rescheduled", Map.of("to", a.getNumber()), null, userId);
            notifier.cancelledByClient(old, c.getName());
            notifier.changed(old);
        }
        notifier.booked(a, c.getName(), s.getName(), b.getName());
        notifier.changed(a);
        return views.booking(a, now);
    }

    /** Upcoming first (soonest first), then the rest newest first. */
    @Transactional(readOnly = true)
    public List<BookingResponse> mine(UUID userId) {
        Instant now = clock.instant();
        List<Appointment> rows = new ArrayList<>(appointments.ofCustomer(userId));
        Comparator<Appointment> soonest = Comparator.comparing(Appointment::getDate)
                .thenComparingInt(Appointment::getStart);
        List<Appointment> up = rows.stream().filter(a -> isAhead(a, now)).sorted(soonest).toList();
        List<Appointment> past = rows.stream().filter(a -> !isAhead(a, now)).sorted(soonest.reversed()).toList();
        List<Appointment> ordered = new ArrayList<>(up);
        ordered.addAll(past);
        return views.bookings(ordered, now);
    }

    @Transactional(readOnly = true)
    public BookingResponse myBooking(UUID userId, String ref) {
        return views.booking(mine(userId, ref), clock.instant());
    }

    @Transactional
    public BookingResponse cancel(UUID userId, String ref) {
        Appointment a = calendar.lock(mine(userId, ref).getId());
        Instant now = clock.instant();
        requireChangeable(a, now);
        a.setStatus(a.getStatus().transitionTo(AppointmentStatus.CANCELLED));
        a.setCancelReason("client");
        calendar.log(a, "cancelled", Map.of("reason", "client", "by", "client"), null, userId);
        String name = clients.byIds(Set.of(a.getClientId())).values().stream().findFirst().map(Client::getName)
                .orElse("");
        notifier.cancelledByClient(a, name);
        notifier.changed(a);
        return views.booking(a, now);
    }

    // ── internals ─────────────────────────────────────────────────────────────────────

    private Appointment mine(UUID userId, String ref) {
        Appointment a = calendar.find(ref);
        if (!userId.equals(a.getCustomerId())) {
            throw new BusinessException(StatusCode.APPOINTMENT_NOT_FOUND);
        }
        return a;
    }

    private void requireChangeable(Appointment a, Instant now) {
        Business b = businesses.findById(a.getBusinessId()).orElse(null);
        if (!a.getStatus().isUpcoming() || !now.isBefore(rules.freeCancelUntil(a, b))) {
            throw new BusinessException(StatusCode.CANCEL_WINDOW_PASSED);
        }
    }

    private static boolean isAhead(Appointment a, Instant now) {
        return a.getStatus().isUpcoming() && Availability.instantOf(a.getDate(), a.end()).isAfter(now);
    }

    private ServiceItem listedService(String ref) {
        String r = ref == null ? "" : ref.trim();
        Optional<ServiceItem> s = services.findBySlugAndDeletedAtIsNull(r);
        if (s.isEmpty()) {
            try {
                s = services.findById(UUID.fromString(r)).filter(x -> x.getDeletedAt() == null);
            } catch (IllegalArgumentException ex) {
                s = Optional.empty();
            }
        }
        return s.orElseThrow(() -> new BusinessException(StatusCode.LISTING_NOT_FOUND));
    }

    private boolean bookable(Business b, ServiceItem s) {
        return b.getType() == BusinessType.SERVICE && b.isOnline() && !b.isSuspended() && s.isBookableOnline()
                && Boolean.TRUE.equals(rules.settings(b).onlineBooking());
    }

    private Map<UUID, List<List<Integer>>> staffOf(Business b, ServiceItem s, UUID only) {
        Map<UUID, List<List<Integer>>> all = rules.staffFor(s, membership.members(b.getId()));
        if (only == null) {
            return all;
        }
        Map<UUID, List<List<Integer>>> one = new LinkedHashMap<>();
        if (all.containsKey(only)) {
            one.put(only, all.get(only));
        }
        return one;
    }

    /** What holds the members' time between the dates; {@code except} (a rescheduled booking) does not. */
    private Availability availabilityOf(Business b, Map<UUID, List<List<Integer>>> staff, LocalDate from,
            LocalDate to, UUID except) {
        List<Availability.Busy> busy = new ArrayList<>();
        if (!staff.isEmpty()) {
            for (Appointment a : appointments.holding(staff.keySet(), from, to, HOLDING)) {
                if (!a.getId().equals(except)) {
                    busy.add(new Availability.Busy(a.getStaffId(), a.getDate(), a.getStart(), a.end(), true));
                }
            }
            for (CalendarBlock k : blocks.ofStaff(staff.keySet(), from, to)) {
                busy.add(new Availability.Busy(k.getStaffId(), k.getDate(), k.getStart(),
                        k.getStart() + k.getDurationMin(), false));
            }
        }
        return new Availability(rules.shop(b), staff, busy, clock.instant());
    }

    /** The service price less its discount, as the marketplace shows it. */
    static BigDecimal netPrice(ServiceItem s) {
        int off = s.getDiscountPct() == null ? 0 : s.getDiscountPct();
        return Money.usd(s.getPrice().multiply(BigDecimal.valueOf(100L - off)).divide(BigDecimal.valueOf(100), 2,
                Money.ROUNDING));
    }
}
