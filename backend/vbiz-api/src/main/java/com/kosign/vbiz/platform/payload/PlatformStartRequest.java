package com.kosign.vbiz.platform.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/auth/platform/start}. {@code intent}: {@code signin}, {@code open} (with
 * {@code businessId}) or {@code connect} (with {@code orgId} and / or {@code businessId}).
 * {@code next}: a same-site path to return to after a plain sign-in.
 */
public record PlatformStartRequest(
        @NotBlank @Pattern(regexp = "signin|open|connect") String intent,
        @Size(max = 36) String businessId,
        @Size(max = 36) String orgId,
        @Size(max = 500) String next) {
}
