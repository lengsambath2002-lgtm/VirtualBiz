package com.kosign.vbiz.common.security;

import java.util.UUID;

/**
 * Says whether an access token's session still counts: not revoked (sign-out everywhere, password
 * reset, suspension) and its account not suspended. The JWT filter asks on every request, so a
 * revoked session stops working at once instead of when its access token expires.
 */
public interface SessionValidator {

    boolean isLive(UUID userId, UUID sessionId);
}
