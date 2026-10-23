package com.kosign.vbiz.notification.event;

import com.kosign.vbiz.notification.domain.Notification;

/** An inbox notification was saved (to a person or to a shop); listeners act once it commits. */
public record NotificationCreated(Notification notification) {
}
