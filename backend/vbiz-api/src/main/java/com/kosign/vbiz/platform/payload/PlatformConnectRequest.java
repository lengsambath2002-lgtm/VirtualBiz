package com.kosign.vbiz.platform.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/businesses/{id}/platform/connect}: the organisation to link the shop to. */
public record PlatformConnectRequest(@NotBlank @Size(max = 36) String orgId) {
}
