package com.kosign.vbiz.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.kosign.vbiz.auth.domain.OtpCode;
import com.kosign.vbiz.auth.domain.OtpPurpose;
import com.kosign.vbiz.auth.repository.OtpCodeRepository;
import com.kosign.vbiz.auth.service.OtpSender;
import com.kosign.vbiz.auth.service.OtpService;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.support.MutableClock;

class OtpServiceTest {

    private static final String TO = "a@b.co";

    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-14T03:00:00Z"));
    private final List<OtpCode> stored = new ArrayList<>();
    private OtpCodeRepository repo;
    private OtpSender sender;
    private OtpService service;

    @BeforeEach
    void setUp() {
        repo = mock(OtpCodeRepository.class);
        sender = mock(OtpSender.class);
        when(repo.save(any(OtpCode.class))).thenAnswer(inv -> inv.getArgument(0));
        when(repo.saveAndFlush(any(OtpCode.class))).thenAnswer(inv -> {
            OtpCode c = inv.getArgument(0);
            c.setCreatedAt(clock.instant());
            stored.add(c);
            return c;
        });
        when(repo.findFirstByPurposeAndTargetOrderByCreatedAtDesc(any(), any())).thenAnswer(inv -> stored.stream()
                .filter(c -> c.getPurpose() == inv.getArgument(0) && c.getTarget().equals(inv.getArgument(1)))
                .max(Comparator.comparing(OtpCode::getCreatedAt)));
        service = new OtpService(repo, sender, clock);
    }

    @Test
    void issue_sets_ten_minute_expiry_and_thirty_second_resend_and_hashes_the_code() {
        OtpService.Issued issued = service.issue(OtpPurpose.LOGIN, TO, null);
        assertThat(issued.code()).matches("\\d{6}");
        assertThat(issued.expiresAt()).isEqualTo(clock.instant().plus(Duration.ofMinutes(10)));
        assertThat(issued.resendAt()).isEqualTo(clock.instant().plus(Duration.ofSeconds(30)));
        assertThat(stored.get(0).getCodeHash()).hasSize(64).doesNotContain(issued.code());
        verify(sender).send(eq(OtpPurpose.LOGIN), eq(TO), eq(issued.code()));
    }

    @Test
    void resend_is_refused_for_thirty_seconds_then_supersedes_the_old_code() {
        OtpService.Issued first = service.issue(OtpPurpose.LOGIN, TO, null);
        clock.advance(Duration.ofSeconds(10));
        assertThatThrownBy(() -> service.issue(OtpPurpose.LOGIN, TO, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatusCode()).isEqualTo(StatusCode.OTP_RESEND_TOO_SOON);
                    assertThat(be.getMeta()).containsEntry("retryAfter", 20L);
                });
        clock.advance(Duration.ofSeconds(20));
        OtpService.Issued second = service.issue(OtpPurpose.LOGIN, TO, null);
        assertThat(stored.get(0).getConsumedAt()).isNotNull();
        clock.advance(Duration.ofSeconds(1));
        if (!first.code().equals(second.code())) {
            assertThatThrownBy(() -> service.verify(OtpPurpose.LOGIN, TO, first.code()))
                    .extracting("statusCode").isEqualTo(StatusCode.OTP_INVALID);
        }
        assertThat(service.verify(OtpPurpose.LOGIN, TO, second.code()).getConsumedAt()).isNotNull();
    }

    @Test
    void five_wrong_codes_kill_the_code() {
        String code = service.issue(OtpPurpose.RESET, TO, null).code();
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int left = 4; left >= 1; left--) {
            int expected = left;
            assertThatThrownBy(() -> service.verify(OtpPurpose.RESET, TO, wrong))
                    .isInstanceOf(BusinessException.class)
                    .satisfies(ex -> {
                        assertThat(((BusinessException) ex).getStatusCode()).isEqualTo(StatusCode.OTP_INVALID);
                        assertThat(((BusinessException) ex).getMeta()).containsEntry("triesLeft", expected);
                    });
        }
        assertThatThrownBy(() -> service.verify(OtpPurpose.RESET, TO, wrong))
                .extracting("statusCode").isEqualTo(StatusCode.OTP_ATTEMPTS_EXCEEDED);
        assertThatThrownBy(() -> service.verify(OtpPurpose.RESET, TO, code))
                .extracting("statusCode").isEqualTo(StatusCode.OTP_ATTEMPTS_EXCEEDED);
    }

    @Test
    void code_expires_after_ten_minutes_and_is_single_use() {
        String code = service.issue(OtpPurpose.LOGIN, TO, null).code();
        clock.advance(Duration.ofMinutes(10));
        assertThatThrownBy(() -> service.verify(OtpPurpose.LOGIN, TO, code))
                .extracting("statusCode").isEqualTo(StatusCode.OTP_EXPIRED);

        clock.advance(Duration.ofMinutes(1));
        String fresh = service.issue(OtpPurpose.LOGIN, TO, null).code();
        service.verify(OtpPurpose.LOGIN, TO, fresh);
        assertThatThrownBy(() -> service.verify(OtpPurpose.LOGIN, TO, fresh))
                .extracting("statusCode").isEqualTo(StatusCode.OTP_EXPIRED);
    }

    @Test
    void no_code_is_expired() {
        when(repo.findFirstByPurposeAndTargetOrderByCreatedAtDesc(OtpPurpose.PHONE, "012345678"))
                .thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.verify(OtpPurpose.PHONE, "012345678", "123456"))
                .extracting("statusCode").isEqualTo(StatusCode.OTP_EXPIRED);
    }
}
