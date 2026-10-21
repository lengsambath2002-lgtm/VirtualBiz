package com.kosign.vbiz.booking.service;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/** Stand-in until an SMS provider is configured: the in-app reminder still goes out. */
@Slf4j
@Component
public class LoggingReminderSms implements ReminderSms {

    @Override
    public void send(String phone, String shopName, String serviceName, String date, String time) {
        log.info("[BOOKING] Reminder SMS for {} at {} on {} {} (SMS provider not configured)", serviceName, shopName,
                date, time);
    }
}
