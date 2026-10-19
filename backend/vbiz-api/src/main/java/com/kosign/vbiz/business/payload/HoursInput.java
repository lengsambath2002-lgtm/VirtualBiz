package com.kosign.vbiz.business.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/** Create Business hours: Monday–Saturday {@code open}–{@code close} ("HH:MM"), Sunday only when {@code sunday}. */
public record HoursInput(
        @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String open,
        @NotBlank @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$|^24:00$") String close,
        @NotNull Boolean sunday) {
}
