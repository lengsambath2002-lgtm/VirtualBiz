package com.kosign.vbiz.account.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/me/password}. {@code currentPassword} may be empty when the account has none yet. */
public record ChangePasswordRequest(@Size(max = 200) String currentPassword, @NotBlank @Size(max = 200) String newPassword) {
}
