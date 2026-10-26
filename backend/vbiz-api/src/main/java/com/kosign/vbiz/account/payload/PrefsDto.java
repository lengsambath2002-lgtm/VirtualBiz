package com.kosign.vbiz.account.payload;

import java.util.Map;

import com.kosign.vbiz.account.domain.NotifyTopic;

import jakarta.validation.constraints.NotNull;

/**
 * Notification preferences: deal alerts, promotional messages and, per topic, whether it comes by
 * email and by push ({@code notify}; topics left out, or {@code notify} left out, stay as they are).
 * Responses list every topic.
 */
public record PrefsDto(@NotNull Boolean deals, @NotNull Boolean promos, Map<NotifyTopic, NotifyChannels> topics) {
}
