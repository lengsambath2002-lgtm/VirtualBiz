package com.kosign.vbiz.booking.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.business.domain.BookingSettings;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.Closure;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.service.CatalogStarters;

/** A service business's booking settings with their defaults, and the windows derived from them. */
@Component
public class BookingRules {

    /** The shop's settings, each missing field taken from {@link BookingSettings#defaults()}. */
    public BookingSettings settings(Business b) {
        BookingSettings d = BookingSettings.defaults();
        BookingSettings s = b == null ? null : b.getBookingSettings();
        if (s == null) {
            return d;
        }
        return new BookingSettings(or(s.onlineBooking(), d.onlineBooking()), or(s.autoConfirm(), d.autoConfirm()),
                or(s.reminderHours(), d.reminderHours()), or(s.minNoticeHours(), d.minNoticeHours()),
                or(s.freeCancelHours(), d.freeCancelHours()), or(s.bufferMinutes(), d.bufferMinutes()),
                or(s.slotMinutes(), d.slotMinutes()), or(s.maxDaysAhead(), d.maxDaysAhead()),
                or(s.tipPresets(), d.tipPresets()),
                or(s.serviceCategories(), CatalogStarters.serviceCategories(b.getCategoryId())));
    }

    /** The customer may cancel or reschedule until the start minus the free-cancellation hours. */
    public Instant freeCancelUntil(Appointment a, Business b) {
        int h = settings(b).freeCancelHours();
        return Availability.instantOf(a.getDate(), a.getStart()).minusSeconds(h * 3600L);
    }

    public Availability.Shop shop(Business b) {
        BookingSettings s = settings(b);
        Set<LocalDate> closed = b.getClosures() == null ? Set.of()
                : b.getClosures().stream().map(Closure::date).filter(java.util.Objects::nonNull)
                        .map(LocalDate::parse).collect(Collectors.toSet());
        return new Availability.Shop(b.getHours(), closed, s.bufferMinutes(), s.minNoticeHours(), s.slotMinutes(),
                s.maxDaysAhead());
    }

    /**
     * Who can perform the service, in the order "first available" tries them: the service's staff
     * (all active members when it lists none), owner first as the members query returns them.
     */
    public Map<UUID, List<List<Integer>>> staffFor(ServiceItem s, List<BusinessMember> active) {
        Map<UUID, List<List<Integer>>> out = new LinkedHashMap<>();
        for (BusinessMember m : active) {
            if (m.isActive() && (s.getStaffIds().isEmpty() || s.getStaffIds().contains(m.getId()))) {
                out.put(m.getId(), m.getShifts());
            }
        }
        return out;
    }

    private static <T> T or(T v, T d) {
        return v == null ? d : v;
    }
}
