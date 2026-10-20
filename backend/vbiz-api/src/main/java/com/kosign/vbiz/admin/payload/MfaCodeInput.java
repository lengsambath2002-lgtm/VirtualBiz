package com.kosign.vbiz.admin.payload;

/** A 6-digit authenticator code, or one recovery code instead. */
public record MfaCodeInput(String code, String recoveryCode) {
}
