package com.kosign.vbiz.auth.payload;

import jakarta.validation.constraints.Size;

/** A 6-digit code from the authenticator app, or one recovery code instead. */
public record TwoStepCodeRequest(@Size(max = 12) String code, @Size(max = 20) String recoveryCode) {
}
