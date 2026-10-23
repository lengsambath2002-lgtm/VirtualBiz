package com.kosign.vbiz.notification.push;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** {@code POST/DELETE /api/me/push-tokens}: a device's Firebase Cloud Messaging token. */
public record PushTokenInput(@NotBlank @Size(max = 512) String token,
        @Pattern(regexp = "web|android|ios") String platform) {
}
