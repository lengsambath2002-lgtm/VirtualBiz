package com.kosign.vbiz.notification.push;

import java.time.Clock;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

/**
 * The devices a person turned push notifications on for. A token is one device: registering it
 * again (another account signed in there) moves it to that account.
 */
@Service
@RequiredArgsConstructor
public class PushTokenService {

    private final PushTokenRepository tokens;
    private final Clock clock;

    @Transactional
    public void register(UUID userId, String token, String platform) {
        PushToken t = tokens.findByToken(token).orElseGet(PushToken::new);
        t.setToken(token);
        t.setUserId(userId);
        t.setPlatform(platform == null || platform.isBlank() ? "web" : platform);
        t.setLastSeen(clock.instant());
        tokens.save(t);
    }

    @Transactional
    public void remove(UUID userId, String token) {
        tokens.deleteMine(token, userId);
    }
}
