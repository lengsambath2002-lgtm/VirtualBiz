package com.kosign.vbiz.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.service.UserService;
import com.kosign.vbiz.auth.service.LoginAttemptService;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.support.MutableClock;

class LoginAttemptServiceTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-14T03:00:00Z"));
    private final UserService users = mock(UserService.class);
    private final LoginAttemptService service = new LoginAttemptService(users, clock);
    private final UUID id = UUID.randomUUID();
    private final User user = User.create("A", "a@b.co", null);

    LoginAttemptServiceTest() {
        user.setId(id);
        when(users.require(id)).thenReturn(user);
        when(users.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void four_failures_count_down_then_the_fifth_locks_for_thirty_seconds() {
        for (int left = 4; left >= 1; left--) {
            int expected = left;
            assertThatThrownBy(() -> service.recordFailure(id))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        BusinessException be = (BusinessException) ex;
                        assertThat(be.getStatusCode()).isEqualTo(StatusCode.INVALID_CREDENTIALS);
                        assertThat(be.getMeta()).containsEntry("reason", "BAD_PASSWORD").containsEntry("triesLeft", expected);
                    });
        }
        assertThatThrownBy(() -> service.recordFailure(id))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatusCode()).isEqualTo(StatusCode.ACCOUNT_LOCKED);
                    assertThat(be.getMeta()).containsEntry("retryAfter", 30L);
                });
        assertThat(user.getLockedUntil()).isEqualTo(clock.instant().plusSeconds(30));
        assertThat(user.getFailedLoginCount()).isZero();

        clock.advance(Duration.ofSeconds(12));
        assertThatThrownBy(() -> service.assertNotLocked(user))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getMeta()).containsEntry("retryAfter", 18L));

        clock.advance(Duration.ofSeconds(18));
        assertThatCode(() -> service.assertNotLocked(user)).doesNotThrowAnyException();
    }

    @Test
    void reset_clears_counter_and_lock() {
        user.setFailedLoginCount(3);
        user.setLockedUntil(clock.instant().plusSeconds(10));
        service.reset(user);
        assertThat(user.getFailedLoginCount()).isZero();
        assertThat(user.getLockedUntil()).isNull();
    }
}
