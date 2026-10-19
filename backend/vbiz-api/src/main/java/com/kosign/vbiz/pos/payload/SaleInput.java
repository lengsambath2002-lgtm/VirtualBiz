package com.kosign.vbiz.pos.payload;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.kosign.vbiz.payment.domain.PaymentMethod;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code POST /api/sales} (docs/api/phase4-bookings-provider.md § Sales). */
public record SaleInput(
        UUID appointmentId,
        UUID clientId,
        @NotEmpty @Size(max = 50) List<@Valid Line> lines,
        @NotNull @DecimalMin("0") BigDecimal discount,
        @NotNull @DecimalMin("0") BigDecimal tip,
        @NotEmpty @Size(max = 5) List<@Valid Payment> payments,
        @Valid Cash cash) {

    public record Line(
            UUID serviceId,
            UUID variantId,
            @NotBlank @Size(max = 160) String title,
            @NotNull @Min(1) @Max(99) Integer qty,
            @NotNull @DecimalMin("0") BigDecimal unitPrice,
            UUID staffId) {
    }

    public record Payment(@NotNull PaymentMethod method, @NotNull @DecimalMin("0") BigDecimal amount) {
    }

    public record Cash(@DecimalMin("0") BigDecimal usd, @Min(0) Long khr, BigDecimal change) {
    }
}
