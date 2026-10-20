package com.kosign.vbiz.admin.payload;

import jakarta.validation.constraints.NotBlank;

/**
 * {@code POST /api/staff-invites/{token}/accept}: a new account's name and password, or an
 * existing account's current password.
 */
public record InviteAcceptInput(String name, @NotBlank String password) {
}
