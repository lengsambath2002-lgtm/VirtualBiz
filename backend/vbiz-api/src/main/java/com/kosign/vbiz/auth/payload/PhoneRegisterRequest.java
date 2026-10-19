package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PhoneRegisterRequest(
        @NotBlank @Size(max = 200) String phoneToken,
        @NotBlank @Size(max = 80) String name,
        @Size(max = 254) String email) {
}
