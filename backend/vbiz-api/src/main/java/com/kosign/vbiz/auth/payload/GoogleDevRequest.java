package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Local/dev stand-in for Google sign-in. */
public record GoogleDevRequest(@NotBlank @Size(max = 254) String email, @Size(max = 80) String name) {
}
