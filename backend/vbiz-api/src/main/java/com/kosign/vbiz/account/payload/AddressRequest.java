package com.kosign.vbiz.account.payload;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.kosign.vbiz.account.domain.AddressLabel;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body of {@code POST /api/me/addresses} and {@code PUT /api/me/addresses/{id}}. */
public record AddressRequest(
        @NotNull AddressLabel label,
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 20) String phone,
        @NotBlank @Size(max = 200) String line,
        @NotBlank @Size(max = 80) String district,
        @Size(max = 300) String note,
        @DecimalMin("-90") @DecimalMax("90") BigDecimal lat,
        @DecimalMin("-180") @DecimalMax("180") BigDecimal lng,
        @JsonProperty("isDefault") Boolean isDefault) {
}
