package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GoogleRequest(@NotBlank @Size(max = 4096) String idToken) {
}
