package com.kosign.vbiz.payment.gateway;

import java.util.Optional;

/**
 * Settlement side of KHQR. A real implementation asks Bakong's open API
 * ({@code check_transaction_by_md5}, needs the merchant's Bakong API token) whether the transfer
 * for a QR arrived. Not built: blocked on credentials; {@link LocalKhqrGateway} is the stand-in.
 */
public interface KhqrGateway {

    /** {@code Optional.of(true)} once the bank confirmed the transfer; empty = not (yet) known. */
    Optional<Boolean> isPaid(String md5);

    /** Sends the money back (refund); the simulator just records it. */
    void refund(String md5, java.math.BigDecimal amount);
}
