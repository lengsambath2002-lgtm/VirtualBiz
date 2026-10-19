package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Size(max = 254) String email,
        @NotBlank @Size(max = 200) String password) {
}
