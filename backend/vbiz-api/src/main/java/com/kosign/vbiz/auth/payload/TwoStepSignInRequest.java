package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /api/auth/two-step}: the ticket from TWO_STEP_REQUIRED and a code (or recovery code). */
public record TwoStepSignInRequest(@NotBlank @Size(max = 100) String ticket, @Size(max = 12) String code,
        @Size(max = 20) String recoveryCode) {
}
