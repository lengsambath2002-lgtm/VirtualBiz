package com.kosign.vbiz.account.payload;

import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.auth.domain.SignInMethod;

/** {@code GET /api/me}: the {@code User} fields plus {@code prefs}. */
public record MeResponse(
        String id,
        String name,
        String email,
        String phone,
        String avatarUrl,
        String coverUrl,
        List<SignInMethod> signInMethods,
        Instant createdAt,
        PrefsDto prefs,
        PlatformRole platformRole) {
}
