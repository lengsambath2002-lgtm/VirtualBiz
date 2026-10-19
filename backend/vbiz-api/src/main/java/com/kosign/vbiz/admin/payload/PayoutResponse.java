package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.Instant;

/** A recorded payout. */
public record PayoutResponse(
        String id,
        String businessId,
        String shopName,
        BigDecimal gross,
        BigDecimal commission,
        BigDecimal amount,
        int payments,
        String bakongId,
        String reference,
        String note,
        Instant paidAt,
        String paidByName) {
}
