package com.kosign.vbiz.order.payload;

import java.util.List;

import com.kosign.vbiz.payment.payload.PaymentIntentResponse;

/** {@code POST /api/checkout}: the orders placed (one per shop) and the payment session, if any. */
public record CheckoutResultResponse(String checkoutId, List<OrderResponse> orders, PaymentIntentResponse payment) {
}
