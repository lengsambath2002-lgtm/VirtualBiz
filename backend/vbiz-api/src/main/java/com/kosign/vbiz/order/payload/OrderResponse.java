package com.kosign.vbiz.order.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.kosign.vbiz.delivery.domain.Rider;
import com.kosign.vbiz.order.domain.OrderAddress;
import com.kosign.vbiz.payment.payload.OrderPaymentResponse;

/** {@code Order} on the wire (customer and seller views share it). */
public record OrderResponse(
        String id,
        String number,
        String checkoutId,
        String businessId,
        Shop shop,
        Customer customer,
        String status,
        String method,
        List<Line> lines,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal promoDiscount,
        String promoCode,
        BigDecimal deliveryFee,
        BigDecimal total,
        OrderPaymentResponse payment,
        String paymentIntentId,
        OrderAddress address,
        String window,
        Instant scheduledFor,
        String note,
        String deliveryBy,
        Rider rider,
        List<Event> timeline,
        Instant createdAt,
        Instant placedAt,
        Instant acceptedAt,
        Instant packedAt,
        Instant shippedAt,
        Instant fulfilledAt,
        Instant cancelledAt,
        Instant returnedAt,
        String cancelReason,
        Instant cancelDeadline,
        boolean canCancel,
        Instant autoCancelAt,
        boolean reviewed) {

    public record Shop(String id, String slug, String name, String phone, String street, String district) {
    }

    public record Customer(String id, String name, String phone, String email) {
    }

    public record Line(String variantId, String productId, String productSlug, String title, String variantName,
            Map<String, String> options, String sku, int qty, BigDecimal listPrice, BigDecimal unitPrice) {
    }

    public record Event(String status, Instant at, String note) {
    }
}
