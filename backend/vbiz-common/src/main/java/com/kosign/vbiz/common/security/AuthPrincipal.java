package com.kosign.vbiz.common.security;

import java.util.UUID;

/** The signed-in user behind a request, read from the access token. */
public record AuthPrincipal(UUID userId, UUID sessionId) {
}
