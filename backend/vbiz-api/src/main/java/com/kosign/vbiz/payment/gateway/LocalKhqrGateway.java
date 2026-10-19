package com.kosign.vbiz.payment.gateway;

import java.math.BigDecimal;
import java.util.Optional;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * LOCAL SIMULATOR — never confirms a transfer by itself: the "Simulate payment" button
 * ({@code POST /api/me/payments/{id}/simulate}, local / dev / test only) plays the bank.
 */
@Slf4j
@Component
public class LocalKhqrGateway implements KhqrGateway {

    @Override
    public Optional<Boolean> isPaid(String md5) {
        return Optional.empty();
    }

    @Override
    public void refund(String md5, BigDecimal amount) {
        log.info("[KHQR simulator] refund {} for {}", amount, md5);
    }
}
