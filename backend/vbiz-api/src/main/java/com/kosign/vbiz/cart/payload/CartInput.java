package com.kosign.vbiz.cart.payload;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code PUT /api/me/cart} and {@code POST /api/me/cart/merge}. */
public record CartInput(
        @NotNull @Size(max = 100) List<@Valid Line> lines,
        @Size(max = 100) List<@Valid Line> later) {

    public record Line(@NotNull UUID variantId, @NotNull @Min(1) @Max(999) Integer qty, Boolean selected) {
    }

    public List<Line> laterOrEmpty() {
        return later == null ? List.of() : later;
    }
}
