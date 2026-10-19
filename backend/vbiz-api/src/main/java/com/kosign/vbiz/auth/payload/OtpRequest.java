package com.kosign.vbiz.auth.payload;

import com.kosign.vbiz.auth.domain.OtpPurpose;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** {@code to} is an email, or a phone number for PHONE. */
public record OtpRequest(@NotNull OtpPurpose purpose, @NotBlank @Size(max = 254) String to) {
}
