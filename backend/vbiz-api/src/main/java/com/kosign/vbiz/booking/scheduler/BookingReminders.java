package com.kosign.vbiz.booking.scheduler;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.booking.domain.Appointment;
import com.kosign.vbiz.booking.repository.AppointmentRepository;
import com.kosign.vbiz.booking.service.Availability;
import com.kosign.vbiz.booking.service.BookingNotifier;
import com.kosign.vbiz.booking.service.BookingProperties;
import com.kosign.vbiz.booking.service.BookingRules;
import com.kosign.vbiz.booking.service.ReminderSms;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.catalog.domain.ServiceItem;
import com.kosign.vbiz.catalog.repository.ServiceItemRepository;
import com.kosign.vbiz.customer.domain.Client;
import com.kosign.vbiz.customer.repository.ClientRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Booking reminders (docs/api/phase13-messages.md): each booked or confirmed visit gets one
 * reminder once its shop's {@code reminderHours} before the start has come (0 = the shop sends
 * none): an in-app notification to the client's account, and an SMS to the client's phone.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BookingReminders {

    /** {@code reminderHours} is at most 168 (7 days). */
    private static final int MAX_DAYS_AHEAD = 8;

    private final AppointmentRepository appointments;
    private final BusinessRepository businesses;
    private final ServiceItemRepository services;
    private final ClientRepository clients;
    private final BookingRules rules;
    private final BookingNotifier notifier;
    private final ReminderSms sms;
    private final BookingProperties props;
    private final Clock clock;

    @Scheduled(fixedDelayString = "${vbiz.bookings.reminders.interval:PT5M}", initialDelayString = "PT30S")
    public void scheduled() {
        if (props.reminders().enabled()) {
            run(clock.instant());
        }
    }

    /** Sends what is due at {@code now}; returns how many reminders went out. */
    @Transactional
    public int run(Instant now) {
        LocalDate today = LocalDate.ofInstant(now, Availability.PHNOM_PENH);
        Map<UUID, Business> shops = new HashMap<>();
        int sent = 0;
        for (Appointment a : appointments.dueForReminder(today, today.plusDays(MAX_DAYS_AHEAD))) {
            Business b = shops.computeIfAbsent(a.getBusinessId(), id -> businesses.findById(id).orElse(null));
            if (b == null) {
                continue;
            }
            int hours = rules.settings(b).reminderHours();
            Instant start = Availability.instantOf(a.getDate(), a.getStart());
            if (hours <= 0 || !start.isAfter(now) || start.isAfter(now.plus(Duration.ofHours(hours)))) {
                continue;
            }
            try {
                String service = services.findById(a.getServiceId()).map(ServiceItem::getName).orElse("");
                notifier.reminder(a, service, b.getName());
                Client c = a.getClientId() == null ? null : clients.findById(a.getClientId()).orElse(null);
                if (c != null && c.getPhone() != null) {
                    sms.send(c.getPhone(), b.getName(), service, a.getDate().toString(),
                            String.format("%02d:%02d", a.getStart() / 60, a.getStart() % 60));
                }
                a.setRemindedAt(now);
                appointments.save(a);
                sent++;
            } catch (RuntimeException ex) {
                log.error("Reminder for appointment {} failed", a.getId(), ex);
            }
        }
        return sent;
    }
}
