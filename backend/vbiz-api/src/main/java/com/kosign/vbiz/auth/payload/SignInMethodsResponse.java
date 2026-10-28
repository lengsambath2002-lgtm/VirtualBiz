package com.kosign.vbiz.auth.payload;

/**
 * {@code GET /api/auth/methods}: which ways in this server can actually deliver. {@code phone} is
 * false while no SMS provider is connected, so the sign-in pages don't offer a text that never comes;
 * {@code platform} is true when sign-in with the Business Platform is set up ({@code VBIZ_PLATFORM_*}).
 */
public record SignInMethodsResponse(boolean phone, boolean platform) {
}
