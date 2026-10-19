package com.kosign.vbiz.payment.gateway;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/** LOCAL SIMULATOR for the card acquirer: approves every charge with a {@code SIM-} reference. */
@Slf4j
@Component
public class LocalCardGateway implements CardGateway {

    @Override
    public Charge charge(BigDecimal amount, String description) {
        String ref = "SIM-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        log.info("[card simulator] approved {} for {} ({})", amount, description, ref);
        return new Charge(true, ref);
    }

    @Override
    public void refund(String reference, BigDecimal amount) {
        log.info("[card simulator] refund {} on {}", amount, reference);
    }
}
