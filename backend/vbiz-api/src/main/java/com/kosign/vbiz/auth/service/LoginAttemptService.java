package com.kosign.vbiz.auth.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.service.UserService;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/**
 * Password lockout (Sign-in prototype): 5 wrong passwords lock the password form for 30 s.
 * Failures are recorded in their own transaction so they survive the failed login.
 */
@Service
@RequiredArgsConstructor
public class LoginAttemptService {

    public static final int MAX_FAILURES = 5;
    public static final Duration LOCK = Duration.ofSeconds(30);

    private final UserService users;
    private final Clock clock;

    /** {@code ACCOUNT_LOCKED} with {@code meta.retryAfter} (seconds) while the lock is on. */
    public void assertNotLocked(User user) {
        Instant now = clock.instant();
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
            throw locked(OtpService.secondsUntil(now, user.getLockedUntil()));
        }
    }

    /**
     * Counts a wrong password and always throws: {@code INVALID_CREDENTIALS} with
     * {@code meta.reason=BAD_PASSWORD} and {@code meta.triesLeft}, or {@code ACCOUNT_LOCKED}
     * on the 5th failure.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BusinessException.class)
    public void recordFailure(UUID userId) {
        User user = users.require(userId);
        int failures = user.getFailedLoginCount() + 1;
        if (failures >= MAX_FAILURES) {
            user.setFailedLoginCount(0);
            user.setLockedUntil(clock.instant().plus(LOCK));
            users.save(user);
            throw locked(LOCK.toSeconds());
        }
        user.setFailedLoginCount(failures);
        users.save(user);
        throw BusinessException.withDetail(StatusCode.INVALID_CREDENTIALS, "password", "Wrong password",
                Map.of("reason", "BAD_PASSWORD", "triesLeft", MAX_FAILURES - failures));
    }

    /** Clears the counter and lock after a successful sign-in (caller's transaction). */
    public void reset(User user) {
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
    }

    private static BusinessException locked(long retryAfter) {
        return BusinessException.withDetail(StatusCode.ACCOUNT_LOCKED, "password",
                "Too many wrong passwords", Map.of("retryAfter", retryAfter));
    }
}
