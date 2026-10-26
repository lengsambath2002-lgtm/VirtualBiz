package com.kosign.vbiz.admin.domain;

/** What an admin action was about. */
public enum AuditTarget {
    USER,
    BUSINESS,
    ORDER,
    REVIEW,
    PROMOTION,
    PAYOUT,
    SETTINGS,
    CATEGORY,
    STAFF_INVITE,
    /** A CSV export of a console list ({@code targetId} = the list). */
    EXPORT,
    /** Homepage banners or a legal page ({@code targetId} = the content key). */
    CONTENT
}
