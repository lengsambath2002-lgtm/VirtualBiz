package com.kosign.vbiz.account.payload;

import java.time.Instant;
import java.util.List;

import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.auth.domain.SignInMethod;

/** {@code User} on the wire. Optional fields are omitted when null. */
public record UserResponse(
        String id,
        String name,
        String email,
        String phone,
        String avatarUrl,
        String coverUrl,
        List<SignInMethod> signInMethods,
        Instant createdAt,
        /** Staff only ({@code ADMIN} / {@code SUPER_ADMIN}); omitted for everyone else. */
        PlatformRole platformRole) {
}
