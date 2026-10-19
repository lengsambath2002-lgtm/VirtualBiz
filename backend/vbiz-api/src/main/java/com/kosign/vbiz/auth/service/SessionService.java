package com.kosign.vbiz.auth.service;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.auth.domain.UserSession;
import com.kosign.vbiz.auth.repository.UserSessionRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.SecureTokens;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Refresh-token sessions. Each refresh rotates the token; presenting a rotated (or revoked)
 * token again is treated as theft and revokes the whole family.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    private final UserSessionRepository sessions;
    private final AuthProperties props;
    private final Clock clock;

    /** A session row plus the plain refresh token (returned once, in the cookie). */
    public record Started(UUID sessionId, UUID userId, String refreshToken) {
    }

    @Transactional
    public Started start(UUID userId, ClientInfo client) {
        return create(userId, UUID.randomUUID(), null, client);
    }

    /**
     * Rotates {@code refreshToken}. {@code REFRESH_TOKEN_INVALID} when unknown, expired, revoked,
     * or already rotated (the last also revokes the family; that write is kept).
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public Started rotate(String refreshToken, ClientInfo client) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw invalid();
        }
        Instant now = clock.instant();
        UserSession current = sessions.lockByTokenHash(SecureTokens.sha256Hex(refreshToken))
                .orElseThrow(SessionService::invalid);
        if (current.getRotatedAt() != null) {
            log.warn("[AUTH] Refresh token reuse detected; revoking session family {}", current.getFamilyId());
            sessions.revokeFamily(current.getFamilyId(), now);
            throw invalid();
        }
        if (!current.isActive(now)) {
            throw invalid();
        }
        current.setRotatedAt(now);
        sessions.saveAndFlush(current);
        return create(current.getUserId(), current.getFamilyId(), current.getId(), client);
    }

    /** Revokes the family of {@code refreshToken} (log out this device). Unknown tokens are ignored. */
    @Transactional
    public void revoke(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        sessions.findByTokenHash(SecureTokens.sha256Hex(refreshToken))
                .ifPresent(s -> sessions.revokeFamily(s.getFamilyId(), clock.instant()));
    }

    @Transactional
    public int revokeAll(UUID userId) {
        return sessions.revokeAllForUser(userId, clock.instant());
    }

    private Started create(UUID userId, UUID familyId, UUID rotatedFrom, ClientInfo client) {
        String token = SecureTokens.randomToken();
        UserSession s = new UserSession();
        s.setUserId(userId);
        s.setFamilyId(familyId);
        s.setRotatedFrom(rotatedFrom);
        s.setTokenHash(SecureTokens.sha256Hex(token));
        s.setExpiresAt(clock.instant().plus(props.refreshTtl()));
        if (client != null) {
            s.setUserAgent(client.userAgent());
            s.setIp(client.ip());
        }
        sessions.saveAndFlush(s);
        return new Started(s.getId(), userId, token);
    }

    private static BusinessException invalid() {
        return new BusinessException(StatusCode.REFRESH_TOKEN_INVALID);
    }
}
