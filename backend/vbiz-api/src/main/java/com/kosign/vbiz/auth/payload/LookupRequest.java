package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LookupRequest(@NotBlank @Size(max = 254) String email) {
}
