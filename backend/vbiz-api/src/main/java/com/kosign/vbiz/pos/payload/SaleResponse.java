package com.kosign.vbiz.pos.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.pos.domain.CashTender;

/** {@code Sale} on the wire (docs/api/phase4-bookings-provider.md § Shapes). */
public record SaleResponse(
        String id,
        String number,
        String businessId,
        String appointmentId,
        String clientId,
        List<Line> lines,
        BigDecimal subtotal,
        BigDecimal discount,
        BigDecimal tip,
        BigDecimal total,
        List<Payment> payments,
        CashTender cash,
        String byName,
        Instant at) {

    public record Line(String serviceId, String variantId, String title, int qty, BigDecimal unitPrice,
            String staffId) {
    }

    public record Payment(PaymentMethod method, BigDecimal amount) {
    }
}
