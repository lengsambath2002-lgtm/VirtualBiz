package com.kosign.vbiz.platform.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/auth/platform/link}: the ticket from a {@code LINK_REQUIRED} answer. */
public record PlatformLinkRequest(@NotBlank @Size(max = 255) String ticket) {
}
