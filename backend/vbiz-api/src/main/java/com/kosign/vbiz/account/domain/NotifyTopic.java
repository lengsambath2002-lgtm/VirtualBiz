package com.kosign.vbiz.account.domain;

/**
 * What a notification is about, for the email and push choices in Your account → Settings
 * (docs/ops/email.md § Choices). The in-app inbox always gets everything.
 */
public enum NotifyTopic {
    /** Your orders: accepted, on the way, delivered, cancelled, returned. */
    ORDERS,
    /** Your bookings: confirmed, declined, changed, cancelled, reminders. */
    BOOKINGS,
    /** Your shops: new orders and bookings, and their cancellations. */
    SHOP_ACTIVITY,
    /** Your shops: products running low. */
    STOCK,
    /** Your shops: new reviews. */
    REVIEWS,
    /** Your shops, from VirtualBiz: ID check, suspension, payouts, categories. */
    ACCOUNT;

    public enum Channel {
        EMAIL,
        PUSH
    }
}
