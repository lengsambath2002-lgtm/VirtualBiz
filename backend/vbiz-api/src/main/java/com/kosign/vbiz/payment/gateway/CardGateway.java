package com.kosign.vbiz.payment.gateway;

import java.math.BigDecimal;

/**
 * Card acquirer. A real implementation (ABA PayWay, ACLEDA, …) needs the shop-of-record's
 * acquirer credentials: blocked; {@link LocalCardGateway} approves every charge.
 */
public interface CardGateway {

    /** The outcome of a charge: approved with the acquirer's reference, or declined. */
    record Charge(boolean approved, String reference) {
    }

    Charge charge(BigDecimal amount, String description);

    void refund(String reference, BigDecimal amount);
}
