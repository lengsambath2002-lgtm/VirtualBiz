package com.kosign.vbiz.business.payload;

import jakarta.validation.constraints.NotBlank;

/** {@code POST /api/join/{token}/accept}: a new account's name and password, or an existing one's password. */
public record JoinAcceptInput(String name, @NotBlank String password) {
}
