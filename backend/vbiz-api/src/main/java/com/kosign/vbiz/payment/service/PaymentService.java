package com.kosign.vbiz.payment.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Money;
import com.kosign.vbiz.meta.service.PlatformSettingsService;
import com.kosign.vbiz.notification.sse.StreamEvent;
import com.kosign.vbiz.payment.domain.IntentStatus;
import com.kosign.vbiz.payment.domain.Payment;
import com.kosign.vbiz.payment.domain.PaymentChannel;
import com.kosign.vbiz.payment.domain.PaymentIntent;
import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.payment.domain.PaymentStatus;
import com.kosign.vbiz.payment.event.PaymentConfirmed;
import com.kosign.vbiz.payment.event.PaymentVoided;
import com.kosign.vbiz.payment.gateway.CardGateway;
import com.kosign.vbiz.payment.gateway.KhqrGateway;
import com.kosign.vbiz.payment.khqr.KhqrBuilder;
import com.kosign.vbiz.payment.payload.OrderPaymentResponse;
import com.kosign.vbiz.payment.payload.PaymentIntentResponse;
import com.kosign.vbiz.payment.repository.PaymentIntentRepository;
import com.kosign.vbiz.payment.repository.PaymentRepository;

import lombok.RequiredArgsConstructor;

/**
 * Payments (docs/api/phase3-orders-checkout.md § Payments): KHQR and card sessions for a checkout,
 * one payment row per order, the 5% commission on online payments, refunds. Placing or cancelling
 * the orders of a session is the order domain's job: it listens to {@link PaymentConfirmed} and
 * {@link PaymentVoided}, which are published inside the same transaction.
 */
@Service
@RequiredArgsConstructor
public class PaymentService {

    public static final String PAYMENT_EXPIRED = "paymentExpired";
    public static final String PAYMENT_CANCELLED = "paymentCancelled";

    private final PaymentIntentRepository intents;
    private final PaymentRepository payments;
    private final KhqrGateway khqrGateway;
    private final CardGateway cardGateway;
    private final PaymentProperties props;
    private final PlatformSettingsService settings;
    private final ApplicationEventPublisher events;
    private final Clock clock;
    private final PaymentOrderRefs refs;

    /** A KHQR for the whole checkout, valid for {@code vbiz.payment.khqr.ttl}. */
    @Transactional
    public PaymentIntent createKhqr(UUID checkoutId, UUID customerId, BigDecimal amount, String billNumber) {
        Instant now = clock.instant();
        PaymentIntent i = new PaymentIntent();
        i.setCheckoutId(checkoutId);
        i.setCustomerId(customerId);
        i.setMethod(PaymentMethod.KHQR);
        i.setStatus(IntentStatus.PENDING);
        i.setAmount(Money.usd(amount));
        i.setExpiresAt(now.plus(props.khqr().ttl()));
        String qr = KhqrBuilder.build(new KhqrBuilder.Request(props.khqr().bakongId(), props.khqr().merchantName(),
                props.khqr().merchantCity(), KhqrBuilder.USD, i.getAmount(), billNumber, "VirtualBiz", "Online",
                now, i.getExpiresAt()));
        i.setKhqr(qr);
        i.setKhqrMd5(KhqrBuilder.md5(qr));
        return intents.save(i);
    }

    /** Charges the card at once; a decline answers {@code PAYMENT_FAILED} and nothing is kept. */
    @Transactional
    public PaymentIntent chargeCard(UUID checkoutId, UUID customerId, BigDecimal amount, String description) {
        CardGateway.Charge c = cardGateway.charge(Money.usd(amount), description);
        if (!c.approved()) {
            throw new BusinessException(StatusCode.PAYMENT_FAILED);
        }
        PaymentIntent i = new PaymentIntent();
        i.setCheckoutId(checkoutId);
        i.setCustomerId(customerId);
        i.setMethod(PaymentMethod.CARD);
        i.setStatus(IntentStatus.PAID);
        i.setAmount(Money.usd(amount));
        i.setGatewayRef(c.reference());
        i.setPaidAt(clock.instant());
        return intents.save(i);
    }

    /** The payment row of a new order. {@code paid} for an approved card. */
    @Transactional
    public Payment createForOrder(UUID orderId, UUID intentId, PaymentMethod method, BigDecimal amount,
            String payoutTo, boolean paid) {
        Payment p = new Payment();
        p.setOrderId(orderId);
        p.setIntentId(intentId);
        p.setMethod(method);
        p.setChannel(method == PaymentMethod.CASH ? PaymentChannel.COD : PaymentChannel.ONLINE);
        p.setAmount(Money.usd(amount));
        p.setCommission(p.getChannel() == PaymentChannel.ONLINE
                ? Money.percentOf(p.getAmount(), settings.commissionPct()) : Money.ZERO);
        p.setPayoutTo(payoutTo);
        p.setStatus(paid ? PaymentStatus.PAID : PaymentStatus.PENDING);
        p.setPaidAt(paid ? clock.instant() : null);
        return payments.save(p);
    }

    /**
     * A manual order's payment (docs/api/phase8-manual-orders.md): paid up front to the shop
     * ({@code DIRECT}, already PAID) or due on delivery / pickup ({@code COD}, PENDING). VirtualBiz
     * never holds this money: no commission, never part of a payout.
     */
    public Payment createManual(UUID orderId, PaymentMethod method, BigDecimal amount, boolean paid) {
        Payment p = new Payment();
        p.setOrderId(orderId);
        p.setMethod(method);
        p.setChannel(paid ? PaymentChannel.DIRECT : PaymentChannel.COD);
        p.setAmount(Money.usd(amount));
        p.setCommission(Money.ZERO);
        p.setStatus(paid ? PaymentStatus.PAID : PaymentStatus.PENDING);
        p.setPaidAt(paid ? clock.instant() : null);
        return payments.save(p);
    }

    @Transactional
    public PaymentIntentResponse get(UUID customerId, UUID id) {
        PaymentIntent i = owned(customerId, id);
        if (i.getStatus() == IntentStatus.PENDING && i.getMethod() == PaymentMethod.KHQR
                && khqrGateway.isPaid(i.getKhqrMd5()).orElse(false)) {
            confirm(i);
        }
        return toResponse(i, refs.numbersOfIntent(i.getId()));
    }

    /** LOCAL SIMULATOR: the bank confirms the KHQR transfer. */
    @Transactional
    public PaymentIntentResponse simulatePaid(UUID customerId, UUID id) {
        if (!props.simulator().enabled()) {
            throw new BusinessException(StatusCode.NOT_FOUND);
        }
        PaymentIntent i = lockOwned(customerId, id);
        requirePending(i);
        if (i.getExpiresAt() != null && !clock.instant().isBefore(i.getExpiresAt())) {
            throw new BusinessException(StatusCode.PAYMENT_EXPIRED);
        }
        confirm(i);
        return toResponse(i, refs.numbersOfIntent(i.getId()));
    }

    /** The customer closed the QR: the session and its orders are cancelled. */
    @Transactional
    public PaymentIntentResponse cancel(UUID customerId, UUID id) {
        PaymentIntent i = lockOwned(customerId, id);
        requirePending(i);
        voidIntent(i, IntentStatus.CANCELLED, PAYMENT_CANCELLED);
        return toResponse(i, refs.numbersOfIntent(i.getId()));
    }

    /** Scheduler: pending KHQR sessions past their expiry. Returns how many expired. */
    @Transactional
    public int expireDue(Instant now) {
        int n = 0;
        for (UUID id : intents.dueToExpire(now)) {
            PaymentIntent i = intents.lockById(id).orElse(null);
            if (i != null && i.getStatus() == IntentStatus.PENDING) {
                voidIntent(i, IntentStatus.EXPIRED, PAYMENT_EXPIRED);
                n++;
            }
        }
        return n;
    }

    /** Scheduler: asks the gateway about pending KHQR sessions (a no-op with the simulator). */
    @Transactional
    public int reconcilePending() {
        int n = 0;
        for (UUID id : intents.pending()) {
            PaymentIntent i = intents.lockById(id).orElse(null);
            if (i != null && i.getStatus() == IntentStatus.PENDING && i.getMethod() == PaymentMethod.KHQR
                    && khqrGateway.isPaid(i.getKhqrMd5()).orElse(false)) {
                confirm(i);
                n++;
            }
        }
        return n;
    }

    /** Cash collected on delivery / pickup. */
    @Transactional
    public void markCollected(UUID orderId) {
        payments.findFirstByOrderId(orderId).ifPresent(p -> {
            if (p.getStatus() == PaymentStatus.PENDING && p.getChannel() == PaymentChannel.COD) {
                p.setStatus(PaymentStatus.PAID);
                p.setPaidAt(clock.instant());
            }
        });
    }

    /**
     * The order was cancelled, rejected or returned: a paid online payment is refunded through its
     * gateway, an unpaid one is cancelled ({@code EXPIRED} when the KHQR ran out). Returns the status.
     */
    @Transactional
    public PaymentStatus settleCancelled(UUID orderId, String reason) {
        Payment p = payments.findFirstByOrderId(orderId).orElse(null);
        if (p == null) {
            return null;
        }
        Instant now = clock.instant();
        if (p.getStatus() == PaymentStatus.PAID) {
            if (p.getChannel() == PaymentChannel.ONLINE && p.getIntentId() != null) {
                intents.findById(p.getIntentId()).ifPresent(i -> {
                    if (i.getMethod() == PaymentMethod.KHQR) {
                        khqrGateway.refund(i.getKhqrMd5(), p.getAmount());
                    } else {
                        cardGateway.refund(i.getGatewayRef(), p.getAmount());
                    }
                });
            }
            p.setStatus(PaymentStatus.REFUNDED);
            p.setRefundedAt(now);
        } else if (p.getStatus() == PaymentStatus.PENDING) {
            p.setStatus(PAYMENT_EXPIRED.equals(reason) ? PaymentStatus.EXPIRED : PaymentStatus.CANCELLED);
        }
        return p.getStatus();
    }

    @Transactional(readOnly = true)
    public Map<UUID, Payment> ofOrders(Collection<UUID> orderIds) {
        if (orderIds.isEmpty()) {
            return Map.of();
        }
        return payments.findByOrderIdIn(orderIds).stream()
                .collect(Collectors.toMap(Payment::getOrderId, Function.identity(), (a, b) -> a));
    }

    @Transactional(readOnly = true)
    public PaymentIntent intentOfCheckout(UUID checkoutId) {
        return intents.findFirstByCheckoutIdOrderByCreatedAtDesc(checkoutId).orElse(null);
    }

    public static OrderPaymentResponse toOrderPayment(Payment p) {
        if (p == null) {
            return null;
        }
        return new OrderPaymentResponse(p.getMethod().name(), p.getChannel().name(), p.getStatus().name(),
                p.getStatus() == PaymentStatus.PAID, p.getAmount(), p.getPaidAt());
    }

    public static PaymentIntentResponse toResponse(PaymentIntent i, List<String> orderNumbers) {
        return new PaymentIntentResponse(i.getId().toString(), i.getMethod().name(), i.getStatus().name(),
                i.getAmount(), "USD", i.getKhqr(), i.getKhqrMd5(), i.getExpiresAt(), i.getPaidAt(), orderNumbers);
    }

    private void confirm(PaymentIntent i) {
        Instant now = clock.instant();
        i.setStatus(IntentStatus.PAID);
        i.setPaidAt(now);
        for (Payment p : payments.findByIntentId(i.getId())) {
            p.setStatus(PaymentStatus.PAID);
            p.setPaidAt(now);
        }
        events.publishEvent(new PaymentConfirmed(i.getId()));
        events.publishEvent(StreamEvent.toUser(i.getCustomerId(), "payment",
                Map.of("id", i.getId().toString(), "status", i.getStatus().name())));
    }

    private void voidIntent(PaymentIntent i, IntentStatus status, String reason) {
        i.setStatus(status);
        events.publishEvent(new PaymentVoided(i.getId(), reason));
        events.publishEvent(StreamEvent.toUser(i.getCustomerId(), "payment",
                Map.of("id", i.getId().toString(), "status", status.name())));
    }

    private static void requirePending(PaymentIntent i) {
        if (i.getStatus() != IntentStatus.PENDING) {
            throw new BusinessException(StatusCode.INVALID_STATUS_TRANSITION, i.getStatus(), "PAID");
        }
    }

    private PaymentIntent owned(UUID customerId, UUID id) {
        return intents.findById(id).filter(i -> i.getCustomerId().equals(customerId))
                .orElseThrow(() -> new BusinessException(StatusCode.PAYMENT_NOT_FOUND));
    }

    private PaymentIntent lockOwned(UUID customerId, UUID id) {
        return intents.lockById(id).filter(i -> i.getCustomerId().equals(customerId))
                .orElseThrow(() -> new BusinessException(StatusCode.PAYMENT_NOT_FOUND));
    }
}
