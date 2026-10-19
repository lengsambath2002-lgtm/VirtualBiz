package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code signup/verify}, {@code login/code}, {@code password/reset/verify}. */
public record EmailCodeRequest(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 12) String code) {
}
