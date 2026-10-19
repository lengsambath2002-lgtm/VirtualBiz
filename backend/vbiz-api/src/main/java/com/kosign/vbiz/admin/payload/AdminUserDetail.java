package com.kosign.vbiz.admin.payload;

import java.time.Instant;
import java.util.List;

/** {@code GET /api/admin/users/{id}}. */
public record AdminUserDetail(
        AdminUserRow user,
        List<String> signInMethods,
        String suspendedReason,
        Instant lastSeenAt,
        long activeSessions,
        long bookings,
        long reviews,
        List<Membership> businesses,
        List<AdminOrderRow> recentOrders,
        List<AuditEntry> history) {

    public record Membership(String businessId, String name, String type, String role, String verification,
            Instant suspendedAt) {
    }
}
