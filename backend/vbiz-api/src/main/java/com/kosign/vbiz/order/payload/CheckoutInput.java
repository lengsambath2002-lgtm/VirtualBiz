package com.kosign.vbiz.order.payload;

import java.util.List;
import java.util.UUID;

import com.kosign.vbiz.order.domain.FulfilmentMethod;
import com.kosign.vbiz.payment.domain.PaymentMethod;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code POST /api/checkout/quote} and {@code POST /api/checkout}. */
public record CheckoutInput(
        @NotEmpty @Size(max = 100) List<@Valid Line> lines,
        FulfilmentMethod method,
        UUID addressId,
        @Size(max = 80) String district,
        @Size(max = 11) String window,
        @Size(max = 120) String note,
        @Size(max = 30) String promoCode,
        PaymentMethod paymentMethod) {

    public record Line(@NotNull UUID variantId, @NotNull @Min(1) @Max(999) Integer qty) {
    }

    public FulfilmentMethod methodOrDefault() {
        return method == null ? FulfilmentMethod.DELIVERY : method;
    }
}
