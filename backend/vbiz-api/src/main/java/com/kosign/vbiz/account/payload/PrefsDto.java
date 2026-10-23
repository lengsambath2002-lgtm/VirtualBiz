package com.kosign.vbiz.account.payload;

import jakarta.validation.constraints.NotNull;

/**
 * Notification preferences: deal alerts, promotional messages and emails about orders, bookings
 * and shops ({@code emails}; left out, it stays as it is).
 */
public record PrefsDto(@NotNull Boolean deals, @NotNull Boolean promos, Boolean emails) {
}
