package com.kosign.vbiz.platform.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/auth/platform/complete}: what the platform sent back to {@code /platform/callback}. */
public record PlatformCompleteRequest(@NotBlank @Size(max = 512) String code, @NotBlank @Size(max = 255) String state) {
}
