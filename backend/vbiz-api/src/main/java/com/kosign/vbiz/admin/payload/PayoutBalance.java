package com.kosign.vbiz.admin.payload;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * What VirtualBiz owes a shop. Released = paid online payments whose order was delivered or picked up
 * at least {@code vbiz.payouts.release-after} (1 day) ago; on hold = paid but not yet released; taken back = payments refunded after
 * they were paid out. {@code payable = released − commission − (taken back − its commission)}.
 */
public record PayoutBalance(
        String businessId,
        String name,
        String type,
        String bakongId,
        String verification,
        boolean suspended,
        long payments,
        BigDecimal released,
        BigDecimal commission,
        BigDecimal takenBack,
        BigDecimal payable,
        BigDecimal onHold,
        Instant lastPayoutAt) {
}
