package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PhoneVerifyRequest(@NotBlank @Size(max = 20) String phone, @NotBlank @Size(max = 12) String code) {
}
