package com.kosign.vbiz.pos.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.payment.domain.PaymentMethod;
import com.kosign.vbiz.pos.domain.CashTender;

/** A counter receipt ({@code PosSale}, docs/api/phase5-pos-promotions-reviews.md § POS). */
public record PosSaleResponse(
        String id,
        String clientRef,
        String number,
        String shiftId,
        List<Line> lines,
        BigDecimal subtotal,
        BigDecimal discount,
        String discountReason,
        BigDecimal total,
        List<SaleResponse.Payment> payments,
        CashTender cash,
        String customerName,
        String byName,
        List<Refund> refunds,
        Instant at) {

    public record Line(String productId, String variantId, String title, String variantName, int qty,
            BigDecimal unitPrice) {
    }

    public record Refund(Instant at, BigDecimal amount, PaymentMethod method, boolean restock,
            List<RefundLine> lines, String byName) {
    }

    public record RefundLine(String variantId, int qty) {
    }
}
