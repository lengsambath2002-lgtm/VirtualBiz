package com.kosign.vbiz.booking.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.domain.AppointmentEvent;
import com.kosign.vbiz.booking.domain.AppointmentSnapshot;
import com.kosign.vbiz.booking.domain.AppointmentSource;
import com.kosign.vbiz.booking.domain.AppointmentStatus;
import com.kosign.vbiz.booking.payload.AppointmentInputs;
import com.kosign.vbiz.booking.payload.AppointmentResponse;
import com.kosign.vbiz.booking.repository.AppointmentEventRepository;
import com.kosign.vbiz.booking.repository.AppointmentRepository;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.business.service.WorkspaceAccess;
import com.kosign.vbiz.business.service.WorkspaceAccess.Workspace;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.customer.domain.Client;
import com.kosign.vbiz.customer.service.ClientService;

import lombok.RequiredArgsConstructor;

/**
 * The provider's calendar (docs/api/phase4-bookings-provider.md § Appointments): list, phone and
 * walk-in bookings, edit / move, status changes, undo, and completion by a sale. Every status change
 * goes through {@link AppointmentStatus#transitionTo}; every change appends an event.
 */
@Service
@RequiredArgsConstructor
public class AppointmentService {

    public static final Set<String> DECLINE_REASONS = Set.of("fullyBooked", "stylistNA", "notOffered");
    public static final Set<String> CANCEL_REASONS = Set.of("clientAsked", "stylistUnavailable", "shopClosed");
    static final int MAX_RANGE_DAYS = 400;

    private final AppointmentRepository appointments;
    private final AppointmentEventRepository events;
    private final AppointmentViews views;
    private final BookingNotifier notifier;
    private final BookingProperties props;
    private final WorkspaceAccess access;
    private final ClientService clients;
    private final ServiceItemRepository services;
    private final BusinessMemberRepository members;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<AppointmentResponse> list(LocalDate from, LocalDate to) {
        Workspace w = workspace();
        LocalDate today = today();
        LocalDate f = from == null ? today.minusDays(props.pastDays()) : from;
        LocalDate t = to == null ? today.plusDays(props.futureDays()) : to;
        requireRange(f, t);
        return views.views(appointments.ofBusiness(w.businessId(), f, t));
    }

    @Transactional(readOnly = true)
    public AppointmentResponse get(String ref) {
        return views.view(shopAppointment(workspace(), ref));
    }

    @Transactional
    public AppointmentResponse create(AppointmentInputs.Create in) {
        Workspace w = workspace();
        if (in.source() == AppointmentSource.ONLINE) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "source", "Use PHONE or WALK_IN");
        }
        ServiceItem s = service(w, in.serviceId());
        BusinessMember m = staff(w, in.staffId());
        requireFits(in.start(), s.getDurationMin());
        Client c;
        if (in.clientId() != null) {
            c = clients.require(w.businessId(), in.clientId());
        } else if (in.client() != null) {
            c = clients.findOrCreate(w.businessId(), null, in.client().name(), in.client().phone(), in.client().email());
        } else {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "clientId", "Choose or add a client");
        }
        Appointment a = new Appointment();
        a.setNumber(nextNumber());
        a.setBusinessId(w.businessId());
        a.setClientId(c.getId());
        a.setServiceId(s.getId());
        a.setStaffId(m.getId());
        a.setDate(in.date());
        a.setStart(in.start());
        a.setDurationMin(s.getDurationMin());
        a.setPrice(s.getPrice());
        a.setSource(in.source());
        a.setStatus(AppointmentStatus.initial(in.source(), false));
        a.setNote(blankToNull(in.note()));
        a = appointments.saveAndFlush(a);
        log(a, in.source() == AppointmentSource.WALK_IN ? "bookedWalkin" : "bookedPhone", Map.of(), null, w.userId());
        notifier.changed(a);
        return views.view(a);
    }

    @Transactional
    public AppointmentResponse update(String ref, AppointmentInputs.Patch in) {
        Workspace w = workspace();
        Appointment a = lock(shopAppointment(w, ref).getId());
        if (!a.getStatus().isEditable()) {
            throw new BusinessException(StatusCode.INVALID_STATUS_TRANSITION, a.getStatus(), a.getStatus());
        }
        AppointmentSnapshot before = a.snapshot();
        boolean edited = false;
        if (in.serviceId() != null && !in.serviceId().equals(a.getServiceId())) {
            ServiceItem s = service(w, in.serviceId());
            a.setServiceId(s.getId());
            a.setDurationMin(s.getDurationMin());
            a.setPrice(s.getPrice());
            edited = true;
        }
        if (in.note() != null && !Objects.equals(blankToNull(in.note()), a.getNote())) {
            a.setNote(blankToNull(in.note()));
            edited = true;
        }
        BusinessMember m = in.staffId() == null ? null : staff(w, in.staffId());
        if (m != null) {
            a.setStaffId(m.getId());
        }
        if (in.date() != null) {
            a.setDate(in.date());
        }
        if (in.start() != null) {
            a.setStart(in.start());
        }
        requireFits(a.getStart(), a.getDurationMin());
        boolean moved = !before.date().equals(a.getDate()) || before.start() != a.getStart()
                || !before.staffId().equals(a.getStaffId());
        if (!edited && !moved) {
            return views.view(a);
        }
        Map<String, String> params = new LinkedHashMap<>();
        if (!edited) {
            params.put("date", a.getDate().toString());
            params.put("time", hm(a.getStart()));
            params.put("staff", (m != null ? m : staff(w, a.getStaffId())).getName());
        }
        log(a, edited ? "edited" : "moved", params, before, w.userId());
        notifier.changed(a);
        if (!before.date().equals(a.getDate()) || before.start() != a.getStart()) {
            notifier.moved(a, serviceName(a), w.business().getName());
        }
        return views.view(a);
    }

    @Transactional
    public AppointmentResponse setStatus(String ref, AppointmentInputs.Status in) {
        Workspace w = workspace();
        Appointment a = lock(shopAppointment(w, ref).getId());
        AppointmentStatus from = a.getStatus();
        AppointmentStatus to = in.status();
        if (to == AppointmentStatus.COMPLETED) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "status", "Complete it with a sale");
        }
        String reason = null;
        if (to == AppointmentStatus.DECLINED) {
            reason = requireReason(in.reason(), DECLINE_REASONS);
        } else if (to == AppointmentStatus.CANCELLED) {
            reason = requireReason(in.reason(), CANCEL_REASONS);
        }
        AppointmentSnapshot before = a.snapshot();
        a.setStatus(from.transitionTo(to));
        if (reason != null) {
            a.setCancelReason(reason);
        }
        if (to == AppointmentStatus.DECLINED && in.message() != null && !in.message().isBlank()) {
            a.setDeclineMessage(in.message().trim());
        }
        Map<String, String> params = new LinkedHashMap<>();
        String code = switch (to) {
            case BOOKED -> from == AppointmentStatus.NO_SHOW ? "reset" : "accepted";
            case DECLINED -> "declined";
            case CONFIRMED -> "confirmed";
            case ARRIVED -> "arrived";
            case STARTED -> "started";
            case NO_SHOW -> "noShow";
            case CANCELLED -> "cancelled";
            default -> "edited";
        };
        if (reason != null) {
            params.put("reason", reason);
        }
        if (to == AppointmentStatus.CANCELLED) {
            params.put("by", "shop");
        }
        log(a, code, params, before, w.userId());
        String shop = w.business().getName();
        if (from == AppointmentStatus.REQUESTED && to == AppointmentStatus.BOOKED) {
            notifier.accepted(a, serviceName(a), shop);
        } else if (to == AppointmentStatus.DECLINED) {
            notifier.declined(a, serviceName(a), shop);
        } else if (to == AppointmentStatus.CANCELLED) {
            notifier.cancelledByShop(a, serviceName(a), shop);
        }
        notifier.changed(a);
        return views.view(a);
    }

    /** Puts back what the shop's last change replaced, within {@code vbiz.bookings.undo-window}. */
    @Transactional
    public AppointmentResponse undo(String ref) {
        Workspace w = workspace();
        Appointment a = lock(shopAppointment(w, ref).getId());
        AppointmentEvent last = events.findFirstByAppointmentIdOrderByAtDescCreatedAtDesc(a.getId()).orElse(null);
        Instant now = clock.instant();
        if (last == null || last.getBefore() == null || now.isAfter(last.getAt().plus(props.undoWindow()))) {
            throw new BusinessException(StatusCode.UNDO_WINDOW_PASSED);
        }
        a.restore(last.getBefore());
        events.delete(last);
        notifier.changed(a);
        return views.view(a);
    }

    /**
     * A sale closed the appointment (checkout): {@code ARRIVED} / {@code STARTED} → {@code COMPLETED},
     * linked to the sale, with a {@code paid} log entry. Runs inside the sale's transaction.
     */
    @Transactional
    public Appointment complete(Workspace w, UUID appointmentId, UUID saleId, String amount, String method) {
        Appointment a = lock(appointmentId);
        if (!a.getBusinessId().equals(w.businessId())) {
            throw new BusinessException(StatusCode.APPOINTMENT_NOT_FOUND);
        }
        a.setStatus(a.getStatus().transitionTo(AppointmentStatus.COMPLETED));
        a.setSaleId(saleId);
        log(a, "paid", Map.of("amount", amount, "method", method), null, w.userId());
        notifier.changed(a);
        return a;
    }

    // ── shared with the customer side ────────────────────────────────────────────────

    String nextNumber() {
        return String.format(Locale.ROOT, "BK-%05d", appointments.nextNumber());
    }

    void log(Appointment a, String code, Map<String, String> params, AppointmentSnapshot before, UUID by) {
        AppointmentEvent e = new AppointmentEvent();
        e.setAppointmentId(a.getId());
        e.setCode(code);
        e.setParams(new LinkedHashMap<>(params));
        e.setBefore(before);
        e.setByUserId(by);
        e.setAt(clock.instant());
        events.save(e);
    }

    Appointment lock(UUID id) {
        return appointments.lockById(id).orElseThrow(() -> new BusinessException(StatusCode.APPOINTMENT_NOT_FOUND));
    }

    /** By number ({@code BK-…}) or id. */
    Appointment find(String ref) {
        Optional<Appointment> a = Optional.empty();
        if (ref != null) {
            String r = ref.trim();
            a = r.toUpperCase(Locale.ROOT).startsWith("BK-") ? appointments.findByNumber(r.toUpperCase(Locale.ROOT))
                    : parseUuid(r).flatMap(appointments::findById);
        }
        return a.orElseThrow(() -> new BusinessException(StatusCode.APPOINTMENT_NOT_FOUND));
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(Availability.PHNOM_PENH));
    }

    static void requireFits(int start, int durationMin) {
        if (start + durationMin > 24 * 60) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "start", "Must end by midnight");
        }
    }

    static void requireRange(LocalDate from, LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "to",
                    "from ≤ to, at most " + MAX_RANGE_DAYS + " days");
        }
    }

    static String hm(int minutes) {
        return String.format(Locale.ROOT, "%02d:%02d", minutes / 60, minutes % 60);
    }

    // ── internals ─────────────────────────────────────────────────────────────────────

    private Workspace workspace() {
        Workspace w = access.member();
        WorkspaceAccess.requireType(w, BusinessType.SERVICE);
        return w;
    }

    private Appointment shopAppointment(Workspace w, String ref) {
        Appointment a = find(ref);
        if (!a.getBusinessId().equals(w.businessId())) {
            throw new BusinessException(StatusCode.APPOINTMENT_NOT_FOUND);
        }
        return a;
    }

    private ServiceItem service(Workspace w, UUID id) {
        return services.findByIdAndBusinessIdAndDeletedAtIsNull(id, w.businessId())
                .orElseThrow(() -> new BusinessException(StatusCode.SERVICE_NOT_FOUND));
    }

    private BusinessMember staff(Workspace w, UUID id) {
        return members.findById(id).filter(m -> m.getBusinessId().equals(w.businessId()) && m.isActive())
                .orElseThrow(() -> BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "staffId",
                        "Not an active member of this business"));
    }

    private String serviceName(Appointment a) {
        return services.findById(a.getServiceId()).map(ServiceItem::getName).orElse("");
    }

    private static String requireReason(String reason, Set<String> allowed) {
        if (reason == null || !allowed.contains(reason)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "reason", "Use one of " + allowed);
        }
        return reason;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static Optional<UUID> parseUuid(String s) {
        try {
            return Optional.of(UUID.fromString(s));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
