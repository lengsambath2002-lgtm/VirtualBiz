package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** {@code GET /api/admin/orders/{number}}: everything support needs to settle a dispute. */
public record AdminOrderDetail(
        AdminOrderRow order,
        String customerEmail,
        String customerPhone,
        String shopPhone,
        Map<String, Object> address,
        String note,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal promoDiscount,
        String promoCode,
        BigDecimal deliveryFee,
        List<Line> lines,
        List<Event> events,
        Payment payment,
        List<AuditEntry> history) {

    public record Line(String title, String variantName, int qty, BigDecimal unitPrice) {
    }

    public record Event(String status, String note, String byName, Instant at) {
    }

    public record Payment(String method, String channel, String status, BigDecimal amount, BigDecimal commission,
            Instant paidAt, Instant refundedAt, String payoutId) {
    }
}
