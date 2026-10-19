package com.kosign.vbiz.booking.payload;

import java.time.LocalDate;
import java.util.UUID;

import com.kosign.vbiz.booking.domain.BlockReason;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** {@code POST /api/blocks}. */
public record BlockInput(
        @NotNull UUID staffId,
        @NotNull LocalDate date,
        @NotNull @Min(0) @Max(1439) Integer start,
        @NotNull @Min(15) @Max(720) Integer durationMin,
        @NotNull BlockReason reason) {
}
