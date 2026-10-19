package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** {@code GET /api/admin/businesses/{id}}: the row plus what a reviewer needs to decide. */
public record AdminBusinessDetail(
        AdminBusinessRow shop,
        String about,
        String phone,
        String email,
        String street,
        String bakongId,
        String verificationNote,
        Instant verifiedAt,
        String verifiedByName,
        String suspendedReason,
        Stats stats,
        List<Member> members,
        List<AdminOrderRow> recentOrders,
        List<AuditEntry> history) {

    public record Stats(long orders, BigDecimal gmv, long bookings, long products, long services,
            BigDecimal paidOut, BigDecimal payable) {
    }

    public record Member(String userId, String name, String role, String title, String email, String phone,
            boolean active) {
    }
}
