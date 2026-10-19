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

    /** Local test hook: move {@code placedAt} back by this many minutes. */
    public record Age(@NotNull @Min(1) @Max(100_000) Integer minutes) {
    }
}
