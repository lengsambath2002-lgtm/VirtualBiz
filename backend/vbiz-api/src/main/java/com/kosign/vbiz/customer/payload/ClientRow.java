package com.kosign.vbiz.customer.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * A customer in the shop's list with lifetime numbers (docs/api/phase16-shop-lists.md): product
 * shops count orders, service providers visits; {@code spent} adds delivered orders and counter
 * sales. {@code segment}: vip (top 20% by spend), new (joined in 30 days), risk (no visit for 3
 * weeks and nothing booked) or null.
 */
public record ClientRow(
        String id,
        String name,
        String phone,
        String email,
        String district,
        String note,
        Instant since,
        String userId,
        long orders,
        long visits,
        long noShows,
        BigDecimal spent,
        Instant lastAt,
        LocalDate nextVisit,
        String segment) {
}
