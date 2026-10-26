package com.kosign.vbiz.auth.payload;

/**
 * Two-step sign-in on this account ({@code GET /api/me/two-step}). Staff turn it on and off in the
 * console ({@code managedInConsole}).
 */
public record TwoStepStatusResponse(boolean enabled, long recoveryCodesLeft, boolean managedInConsole) {
}
