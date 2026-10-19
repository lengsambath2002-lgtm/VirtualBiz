package com.kosign.vbiz.account.payload;

import jakarta.validation.constraints.NotNull;

/** Notification preferences: deal alerts and promotional messages. */
public record PrefsDto(@NotNull Boolean deals, @NotNull Boolean promos) {
}
