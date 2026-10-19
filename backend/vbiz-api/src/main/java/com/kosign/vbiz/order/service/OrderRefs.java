package com.kosign.vbiz.order.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.order.repository.OrderRepository;
import com.kosign.vbiz.payment.domain.Payment;
import com.kosign.vbiz.payment.repository.PaymentRepository;
import com.kosign.vbiz.payment.service.PaymentOrderRefs;

import lombok.RequiredArgsConstructor;

/** Order numbers of a payment session, for {@code PaymentIntent.orderNumbers}. */
@Component
@RequiredArgsConstructor
public class OrderRefs implements PaymentOrderRefs {

    private final PaymentRepository payments;
    private final OrderRepository orders;

    @Override
    public List<String> numbersOfIntent(UUID intentId) {
        List<UUID> ids = payments.findByIntentId(intentId).stream().map(Payment::getOrderId).distinct().toList();
        return ids.isEmpty() ? List.of() : orders.numbersOf(ids);
    }
}
