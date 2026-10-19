package com.kosign.vbiz.auth.service;

import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.auth.repository.UserSessionRepository;
import com.kosign.vbiz.common.security.SessionValidator;

import lombok.RequiredArgsConstructor;

/** {@link SessionValidator} over {@code user_session} and the account's suspension. */
@Component
@RequiredArgsConstructor
public class SessionLiveness implements SessionValidator {

    private final UserSessionRepository sessions;

    @Override
    @Transactional(readOnly = true)
    public boolean isLive(UUID userId, UUID sessionId) {
        return userId != null && sessionId != null && sessions.isLive(userId, sessionId);
    }
}
