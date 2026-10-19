package com.kosign.vbiz.booking.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.domain.AppointmentEvent;
import com.kosign.vbiz.booking.payload.AppointmentResponse;
import com.kosign.vbiz.booking.payload.BookingResponse;
import com.kosign.vbiz.booking.repository.AppointmentEventRepository;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.customer.domain.Client;
import com.kosign.vbiz.customer.service.ClientService;

import lombok.RequiredArgsConstructor;

/** Builds {@link AppointmentResponse} / {@link BookingResponse} for many appointments with a few queries. */
@Component
@RequiredArgsConstructor
public class AppointmentViews {

    private final AppointmentEventRepository events;
    private final ClientService clients;
    private final ServiceItemRepository services;
    private final BusinessRepository businesses;
    private final BusinessMemberRepository members;
    private final BookingRules rules;

    @Transactional(readOnly = true)
    public List<AppointmentResponse> views(List<Appointment> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, Client> cs = clients.byIds(ids(rows, Appointment::getClientId));
        Map<UUID, ServiceItem> ss = byId(services.findAllById(ids(rows, Appointment::getServiceId)), ServiceItem::getId);
        Map<UUID, List<AppointmentEvent>> log = new HashMap<>();
        for (AppointmentEvent e : events.findByAppointmentIdInOrderByAtAscCreatedAtAsc(ids(rows, Appointment::getId))) {
            log.computeIfAbsent(e.getAppointmentId(), k -> new ArrayList<>()).add(e);
        }
        return rows.stream().map(a -> view(a, cs.get(a.getClientId()), ss.get(a.getServiceId()),
                log.getOrDefault(a.getId(), List.of()))).toList();
    }

    @Transactional(readOnly = true)
    public AppointmentResponse view(Appointment a) {
        return views(List.of(a)).get(0);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> bookings(List<Appointment> rows, Instant now) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<UUID, ServiceItem> ss = byId(services.findAllById(ids(rows, Appointment::getServiceId)), ServiceItem::getId);
        Map<UUID, Business> bs = byId(businesses.findAllById(ids(rows, Appointment::getBusinessId)), Business::getId);
        Map<UUID, BusinessMember> ms = byId(members.findAllById(ids(rows, Appointment::getStaffId)),
                BusinessMember::getId);
        return rows.stream().map(a -> booking(a, ss.get(a.getServiceId()), bs.get(a.getBusinessId()),
                ms.get(a.getStaffId()), now)).toList();
    }

    @Transactional(readOnly = true)
    public BookingResponse booking(Appointment a, Instant now) {
        return bookings(List.of(a), now).get(0);
    }

    private AppointmentResponse view(Appointment a, Client c, ServiceItem s, List<AppointmentEvent> log) {
        return new AppointmentResponse(a.getId().toString(), a.getNumber(), a.getBusinessId().toString(),
                a.getClientId().toString(),
                c == null ? null : new AppointmentResponse.ClientRef(c.getId().toString(), c.getName(), c.getPhone(),
                        c.getEmail()),
                a.getServiceId().toString(), s == null ? "" : s.getName(), a.getStaffId().toString(),
                a.getDate().toString(), a.getStart(), a.getDurationMin(), a.getPrice(), a.getStatus(), a.getSource(),
                a.getNote(), a.getSaleId() == null ? null : a.getSaleId().toString(), a.isRescheduled(),
                a.getCancelReason(),
                log.stream().map(e -> new AppointmentResponse.LogEntry(e.getCode(),
                        e.getParams() == null || e.getParams().isEmpty() ? null : new LinkedHashMap<>(e.getParams()),
                        e.getAt())).toList(),
                a.getCreatedAt());
    }

    private BookingResponse booking(Appointment a, ServiceItem s, Business b, BusinessMember m, Instant now) {
        Instant until = rules.freeCancelUntil(a, b);
        return new BookingResponse(a.getId().toString(), a.getNumber(), a.getStatus(), a.isRescheduled(),
                a.getCancelReason(),
                s == null ? null : new BookingResponse.ServiceRef(s.getId().toString(), s.getSlug(), s.getName()),
                b == null ? null : new BookingResponse.ShopRef(b.getId().toString(), b.getSlug(), b.getName(),
                        b.getPhone(), b.getStreet(), b.getDistrict()),
                m == null ? null : new BookingResponse.StaffRef(m.getId().toString(), m.getName()),
                a.getDate().toString(), a.getStart(), a.getDurationMin(), a.getPrice(), a.getNote(), a.getCreatedAt(),
                until, a.getStatus().isUpcoming() && now.isBefore(until));
    }

    private static <T> Set<UUID> ids(Collection<Appointment> rows, Function<Appointment, UUID> f) {
        return rows.stream().map(f).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
    }

    private static <T> Map<UUID, T> byId(Collection<T> rows, Function<T, UUID> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity()));
    }
}
