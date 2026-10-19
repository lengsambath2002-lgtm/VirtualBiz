package com.kosign.vbiz.common.security;

import java.util.Optional;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/** The signed-in user of the current request (set by {@link JwtAuthenticationFilter}). */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Optional<AuthPrincipal> principal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthPrincipal p) {
            return Optional.of(p);
        }
        return Optional.empty();
    }

    /** The user id; throws {@code UNAUTHORIZED} when the request is anonymous. */
    public static UUID id() {
        return principal().map(AuthPrincipal::userId)
                .orElseThrow(() -> new BusinessException(StatusCode.UNAUTHORIZED));
    }
}
