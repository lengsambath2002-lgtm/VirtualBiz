package com.kosign.vbiz.booking.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.notification.domain.NotificationKind;
import com.kosign.vbiz.notification.service.NotificationService;
import com.kosign.vbiz.notification.sse.StreamEvent;

import lombok.RequiredArgsConstructor;

/** Inbox entries and live events for appointments (sent once the transaction commits). */
@Component
@RequiredArgsConstructor
public class BookingNotifier {

    private final NotificationService notifications;
    private final ApplicationEventPublisher events;

    /** Every change: the shop's stream, and the customer's when they booked online. */
    public void changed(Appointment a) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", a.getId().toString());
        data.put("number", a.getNumber());
        data.put("businessId", a.getBusinessId().toString());
        data.put("status", a.getStatus().name());
        events.publishEvent(new StreamEvent(a.getCustomerId() == null ? Set.of() : Set.of(a.getCustomerId()),
                Set.of(a.getBusinessId()), "appointment", data));
    }

    /** An online booking: the shop hears of a request; the customer gets a receipt in their inbox. */
    public void booked(Appointment a, String clientName, String serviceName, String shopName) {
        if (a.getStatus() == com.kosign.vbiz.booking.domain.AppointmentStatus.REQUESTED) {
            Map<String, String> p = when(a);
            p.put("number", a.getNumber());
            p.put("name", clientName);
            p.put("service", serviceName);
            notifications.toBusiness(a.getBusinessId(), NotificationKind.BOOKING_REQUESTED, p, shopRoute(a));
        }
        toCustomer(a, a.getStatus() == com.kosign.vbiz.booking.domain.AppointmentStatus.REQUESTED
                ? NotificationKind.BOOKING_REQUESTED : NotificationKind.BOOKING_CONFIRMED, serviceName, shopName,
                Map.of());
    }

    public void accepted(Appointment a, String serviceName, String shopName) {
        toCustomer(a, NotificationKind.BOOKING_CONFIRMED, serviceName, shopName, Map.of());
    }

    public void declined(Appointment a, String serviceName, String shopName) {
        Map<String, String> p = new java.util.HashMap<>(reason(a));
        if (a.getDeclineMessage() != null) {
            p.put("message", a.getDeclineMessage());
        }
        toCustomer(a, NotificationKind.BOOKING_DECLINED, serviceName, shopName, p);
    }

    /** The visit is coming up (the shop's reminder hours before). */
    public void reminder(Appointment a, String serviceName, String shopName) {
        toCustomer(a, NotificationKind.BOOKING_REMINDER, serviceName, shopName, Map.of());
    }

    /** The shop cancelled: tell the customer. */
    public void cancelledByShop(Appointment a, String serviceName, String shopName) {
        toCustomer(a, NotificationKind.BOOKING_CANCELLED, serviceName, shopName, reason(a));
    }

    /** The customer cancelled: tell the shop. */
    public void cancelledByClient(Appointment a, String clientName) {
        Map<String, String> p = when(a);
        p.put("number", a.getNumber());
        p.put("name", clientName);
        p.putAll(reason(a));
        notifications.toBusiness(a.getBusinessId(), NotificationKind.BOOKING_CANCELLED, p, shopRoute(a));
    }

    /** The shop moved an online booking to another day or time. */
    public void moved(Appointment a, String serviceName, String shopName) {
        toCustomer(a, NotificationKind.BOOKING_CHANGED, serviceName, shopName, Map.of());
    }

    private void toCustomer(Appointment a, String kind, String serviceName, String shopName, Map<String, String> extra) {
        if (a.getCustomerId() == null) {
            return;
        }
        Map<String, String> p = when(a);
        p.put("number", a.getNumber());
        p.put("shop", shopName);
        p.put("service", serviceName);
        p.putAll(extra);
        notifications.toUser(a.getCustomerId(), kind, p, "/bookings/" + a.getNumber());
    }

    private static Map<String, String> when(Appointment a) {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("date", a.getDate().toString());
        p.put("time", String.format("%02d:%02d", a.getStart() / 60, a.getStart() % 60));
        return p;
    }

    private static Map<String, String> reason(Appointment a) {
        return a.getCancelReason() == null ? Map.of() : Map.of("reason", a.getCancelReason());
    }

    static String shopRoute(Appointment a) {
        return "/provider/calendar?date=" + a.getDate() + "&appt=" + a.getId();
    }
}
