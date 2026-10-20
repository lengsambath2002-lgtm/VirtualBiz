package com.kosign.vbiz.order.payload;

import java.util.List;
import java.util.UUID;

import com.kosign.vbiz.delivery.domain.DeliveryProvider;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies of the order endpoints. */
public final class OrderInputs {

    private OrderInputs() {
    }

    public record Ids(@NotEmpty @Size(max = 200) List<@NotNull UUID> ids) {
    }

    public record Bulk(@NotBlank String action, @NotEmpty @Size(max = 200) List<@NotNull UUID> ids) {
    }

    public record CustomerCancel(@NotBlank String reason) {
    }

    public record Reject(@NotBlank String reason, Boolean markSoldOut) {
    }

    public record Ship(@NotNull DeliveryProvider deliveryBy) {
    }

    public record Fail(@NotBlank String reason) {
    }

    public record Return(@NotBlank String reason, Boolean restock) {
    }

    /**
     * {@code POST /api/orders/manual}: an order the shop took by phone, Facebook, Telegram or at
     * the counter. {@code phone} is required for delivery; {@code deliveryFee} defaults to the
     * shop's zone fee for the district; {@code discount} is a flat USD amount off the items.
     */
    public record Manual(
            @NotNull com.kosign.vbiz.order.domain.OrderSource source,
            @NotBlank @Size(max = 80) String name,
            @Size(max = 20) String phone,
            @NotNull com.kosign.vbiz.order.domain.FulfilmentMethod method,
            @Size(max = 200) String line,
            @Size(max = 80) String district,
            @Size(max = 120) String addressNote,
            @NotEmpty @Size(max = 50) List<@NotNull @jakarta.validation.Valid ManualLine> lines,
            @jakarta.validation.constraints.DecimalMin("0") java.math.BigDecimal deliveryFee,
            @jakarta.validation.constraints.DecimalMin("0") java.math.BigDecimal discount,
            @NotNull ManualPayment payment,
            @Size(max = 120) String note) {
    }

    public record ManualLine(@NotNull UUID variantId, @NotNull @Min(1) @Max(999) Integer qty) {
    }

    /** Cash on delivery / at pickup, or already paid to the shop (cash in hand, or KHQR / transfer). */
    public enum ManualPayment {
        COD,
        PAID_CASH,
        PAID_KHQR
    }

    /** Local test hook: move {@code placedAt} back by this many minutes. */
    public record Age(@NotNull @Min(1) @Max(100_000) Integer minutes) {
    }
}
