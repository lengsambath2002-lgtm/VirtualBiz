package com.kosign.vbiz.notification.payload;

import java.time.Instant;
import java.util.Map;

/** {@code Notification} on the wire. */
public record NotificationResponse(String id, String kind, Map<String, String> params, String route, boolean unread,
        Instant at) {
}
