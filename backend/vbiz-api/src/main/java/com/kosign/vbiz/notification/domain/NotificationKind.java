package com.kosign.vbiz.notification.domain;

/**
 * Inbox kinds (docs/api/phase3-orders-checkout.md § Notifications, phase4-bookings-provider.md §
 * Notifications, phase7-admin.md § Notifications). The client translates them.
 */
public final class NotificationKind {

    // customer
    public static final String ORDER_ACCEPTED = "ORDER_ACCEPTED";
    public static final String ORDER_READY_PICKUP = "ORDER_READY_PICKUP";
    public static final String ORDER_ON_THE_WAY = "ORDER_ON_THE_WAY";
    public static final String ORDER_DELIVERED = "ORDER_DELIVERED";
    public static final String ORDER_PICKED_UP = "ORDER_PICKED_UP";
    public static final String ORDER_RETURNED = "ORDER_RETURNED";
    public static final String BOOKING_CONFIRMED = "BOOKING_CONFIRMED";
    public static final String BOOKING_DECLINED = "BOOKING_DECLINED";
    public static final String BOOKING_CHANGED = "BOOKING_CHANGED";
    // both
    public static final String ORDER_CANCELLED = "ORDER_CANCELLED";
    public static final String BOOKING_REQUESTED = "BOOKING_REQUESTED";
    public static final String BOOKING_CANCELLED = "BOOKING_CANCELLED";
    public static final String BOOKING_REMINDER = "BOOKING_REMINDER";
    // shop
    public static final String NEW_ORDER = "NEW_ORDER";
    public static final String LOW_STOCK = "LOW_STOCK";
    public static final String NEW_REVIEW = "NEW_REVIEW";
    // shop, from VirtualBiz (docs/api/phase7-admin.md)
    public static final String BUSINESS_VERIFIED = "BUSINESS_VERIFIED";
    public static final String BUSINESS_REJECTED = "BUSINESS_REJECTED";
    public static final String BUSINESS_SUSPENDED = "BUSINESS_SUSPENDED";
    public static final String BUSINESS_REINSTATED = "BUSINESS_REINSTATED";
    public static final String PAYOUT_SENT = "PAYOUT_SENT";

    private NotificationKind() {
    }
}
