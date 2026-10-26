package com.kosign.vbiz.notification.service;

import com.kosign.vbiz.account.domain.NotifyTopic;
import com.kosign.vbiz.notification.domain.Notification;
import com.kosign.vbiz.notification.domain.NotificationKind;

/** Which email / push choice ({@link NotifyTopic}) a notification falls under. */
public final class NotificationTopics {

    private NotificationTopics() {
    }

    public static NotifyTopic of(Notification n) {
        String kind = n.getKind();
        if (n.getBusinessId() == null) {
            return kind.startsWith("BOOKING_") ? NotifyTopic.BOOKINGS : NotifyTopic.ORDERS;
        }
        return switch (kind) {
            case NotificationKind.LOW_STOCK -> NotifyTopic.STOCK;
            case NotificationKind.NEW_REVIEW -> NotifyTopic.REVIEWS;
            case NotificationKind.BUSINESS_VERIFIED, NotificationKind.BUSINESS_REJECTED,
                    NotificationKind.BUSINESS_SUSPENDED, NotificationKind.BUSINESS_REINSTATED,
                    NotificationKind.PAYOUT_SENT, NotificationKind.CATEGORY_APPROVED,
                    NotificationKind.CATEGORY_REJECTED -> NotifyTopic.ACCOUNT;
            default -> NotifyTopic.SHOP_ACTIVITY;
        };
    }
}
