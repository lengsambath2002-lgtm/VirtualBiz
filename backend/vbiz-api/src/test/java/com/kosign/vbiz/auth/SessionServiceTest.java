package com.kosign.vbiz.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.kosign.vbiz.auth.domain.UserSession;
import com.kosign.vbiz.auth.repository.UserSessionRepository;
import com.kosign.vbiz.auth.service.AuthProperties;
import com.kosign.vbiz.auth.service.ClientInfo;
import com.kosign.vbiz.auth.service.SessionService;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.security.SecureTokens;
import com.kosign.vbiz.support.MutableClock;

class SessionServiceTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-14T03:00:00Z"));
    private final Map<String, UserSession> byHash = new HashMap<>();
    private UserSessionRepository repo;
    private SessionService service;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        repo = mock(UserSessionRepository.class);
        when(repo.saveAndFlush(any(UserSession.class))).thenAnswer(inv -> {
            UserSession s = inv.getArgument(0);
            if (s.getId() == null) {
                s.setId(UUID.randomUUID());
            }
            byHash.put(s.getTokenHash(), s);
            return s;
        });
        when(repo.lockByTokenHash(anyString())).thenAnswer(inv -> Optional.ofNullable(byHash.get(inv.getArgument(0))));
        service = new SessionService(repo, new AuthProperties(Duration.ofDays(30), false, false), clock);
    }

    @Test
    void start_stores_only_the_hash_with_thirty_day_expiry() {
        SessionService.Started s = service.start(userId, new ClientInfo("ua", "127.0.0.1"));
        UserSession row = byHash.get(SecureTokens.sha256Hex(s.refreshToken()));
        assertThat(row).isNotNull();
        assertThat(row.getTokenHash()).isNotEqualTo(s.refreshToken());
        assertThat(row.getExpiresAt()).isEqualTo(clock.instant().plus(Duration.ofDays(30)));
        assertThat(row.getFamilyId()).isNotNull();
    }

    @Test
    void rotate_issues_a_new_token_in_the_same_family() {
        SessionService.Started first = service.start(userId, ClientInfo.UNKNOWN);
        SessionService.Started second = service.rotate(first.refreshToken(), ClientInfo.UNKNOWN);
        assertThat(second.refreshToken()).isNotEqualTo(first.refreshToken());
        UserSession old = byHash.get(SecureTokens.sha256Hex(first.refreshToken()));
        UserSession next = byHash.get(SecureTokens.sha256Hex(second.refreshToken()));
        assertThat(old.getRotatedAt()).isNotNull();
        assertThat(next.getFamilyId()).isEqualTo(old.getFamilyId());
        assertThat(next.getRotatedFrom()).isEqualTo(old.getId());
        verify(repo, never()).revokeFamily(any(), any());
    }

    @Test
    void reusing_a_rotated_token_revokes_the_family() {
        SessionService.Started first = service.start(userId, ClientInfo.UNKNOWN);
        service.rotate(first.refreshToken(), ClientInfo.UNKNOWN);
        assertThatThrownBy(() -> service.rotate(first.refreshToken(), ClientInfo.UNKNOWN))
                .extracting("statusCode").isEqualTo(StatusCode.REFRESH_TOKEN_INVALID);
        UUID family = byHash.get(SecureTokens.sha256Hex(first.refreshToken())).getFamilyId();
        verify(repo).revokeFamily(eq(family), any());
    }

    @Test
    void expired_unknown_and_missing_tokens_are_invalid() {
        SessionService.Started s = service.start(userId, ClientInfo.UNKNOWN);
        clock.advance(Duration.ofDays(30));
        assertThatThrownBy(() -> service.rotate(s.refreshToken(), ClientInfo.UNKNOWN))
                .extracting("statusCode").isEqualTo(StatusCode.REFRESH_TOKEN_INVALID);
        assertThatThrownBy(() -> service.rotate("nope", ClientInfo.UNKNOWN))
                .extracting("statusCode").isEqualTo(StatusCode.REFRESH_TOKEN_INVALID);
        assertThatThrownBy(() -> service.rotate(null, ClientInfo.UNKNOWN))
                .extracting("statusCode").isEqualTo(StatusCode.REFRESH_TOKEN_INVALID);
    }
}
