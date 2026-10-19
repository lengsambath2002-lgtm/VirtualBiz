package com.kosign.vbiz.pos.payload;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.kosign.vbiz.payment.domain.PaymentMethod;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Bodies of the Seller register calls (docs/api/phase5-pos-promotions-reviews.md § POS). */
public final class PosInputs {

    private PosInputs() {
    }

    public record OpenShift(@NotNull @DecimalMin("0") BigDecimal floatUsd, @NotNull @Min(0) Long floatKhr) {
    }

    public record CashMove(@NotNull BigDecimal amount, @Size(max = 80) String note) {
    }

    public record CloseShift(@NotNull @DecimalMin("0") BigDecimal countedUsd) {
    }

    public record Line(@NotNull UUID variantId, @NotNull @Min(1) @Max(999) Integer qty,
            @NotNull @DecimalMin("0") BigDecimal unitPrice) {
    }

    public record Payment(@NotNull PaymentMethod method, @NotNull @DecimalMin("0") BigDecimal amount) {
    }

    public record Cash(@DecimalMin("0") BigDecimal usd, @Min(0) Long khr, BigDecimal change) {
    }

    public record Sale(
            @NotNull UUID clientRef,
            @NotEmpty @Size(max = 100) List<@Valid Line> lines,
            @NotNull @DecimalMin("0") BigDecimal discount,
            @Size(max = 20) String discountReason,
            @Size(max = 80) String customerName,
            @NotEmpty @Size(max = 5) List<@Valid Payment> payments,
            @Valid Cash cash,
            Instant at) {
    }

    public record RefundLine(@NotNull UUID variantId, @NotNull @Min(1) Integer qty) {
    }

    public record Refund(@NotEmpty @Size(max = 100) List<@Valid RefundLine> lines,
            @NotNull @DecimalMin("0.01") BigDecimal amount, @NotNull PaymentMethod method, Boolean restock) {
    }
}
