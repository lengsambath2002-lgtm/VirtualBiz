package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.Instant;

/** An order in the admin list (any shop). {@code at} = placed, or created while unpaid. */
public record AdminOrderRow(
        String id,
        String number,
        String status,
        String method,
        BigDecimal total,
        String paymentMethod,
        String paymentStatus,
        String businessId,
        String shopName,
        String customerId,
        String customerName,
        String cancelReason,
        Instant at) {
}
