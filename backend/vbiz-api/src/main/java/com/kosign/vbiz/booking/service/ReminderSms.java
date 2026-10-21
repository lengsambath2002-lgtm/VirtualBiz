package com.kosign.vbiz.booking.service;

/** Sends a booking reminder by SMS. Replace the logging implementation with the SMS provider's. */
public interface ReminderSms {

    void send(String phone, String shopName, String serviceName, String date, String time);
}
