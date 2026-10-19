package com.kosign.vbiz.order.scheduler;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.order.service.OrderProperties;
import com.kosign.vbiz.order.service.OrderService;
import com.kosign.vbiz.payment.service.PaymentService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Background order rules: KHQR sessions past their expiry are voided (their orders cancelled and
 * restocked), and placed orders not accepted within {@code vbiz.orders.auto-cancel-after} (1 h)
 * are cancelled. Each order is its own transaction, so one failure does not block the rest.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrderJobs {

    /** What one run did. */
    public record Run(int expiredPayments, int autoCancelled) {
    }

    private final OrderService orders;
    private final PaymentService payments;
    private final OrderProperties props;
    private final Clock clock;

    @Scheduled(fixedDelayString = "${vbiz.orders.jobs.interval:PT1M}", initialDelayString = "PT20S")
    public void scheduled() {
        if (props.jobs().enabled()) {
            run(clock.instant());
        }
    }

    public Run run(Instant now) {
        int expired = 0;
        try {
            payments.reconcilePending();
            expired = payments.expireDue(now);
        } catch (RuntimeException ex) {
            log.error("Payment expiry failed", ex);
        }
        int cancelled = 0;
        Instant cutoff = now.minus(props.autoCancelAfter());
        for (UUID id : orders.dueForAutoCancel(now)) {
            try {
                if (orders.autoCancel(id, cutoff)) {
                    cancelled++;
                }
            } catch (RuntimeException ex) {
                log.error("Auto-cancel of order {} failed", id, ex);
            }
        }
        if (expired + cancelled > 0) {
            log.info("Order jobs: {} KHQR payment(s) expired, {} order(s) auto-cancelled", expired, cancelled);
        }
        return new Run(expired, cancelled);
    }
}
