package com.kosign.vbiz.auth.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.auth.domain.OtpCode;
import com.kosign.vbiz.auth.domain.OtpPurpose;
import com.kosign.vbiz.auth.domain.PendingSignup;
import com.kosign.vbiz.auth.repository.OtpCodeRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.SecureTokens;

import lombok.RequiredArgsConstructor;

/**
 * One-time codes (Sign-in prototype rules): 6 digits, valid 10 minutes, resend after 30 s,
 * 5 wrong tries kill the code. Codes are stored as SHA-256 hashes.
 */
@Service
@RequiredArgsConstructor
public class OtpService {

    public static final int CODE_LENGTH = 6;
    public static final Duration TTL = Duration.ofMinutes(10);
    public static final Duration RESEND_AFTER = Duration.ofSeconds(30);
    public static final int MAX_ATTEMPTS = 5;

    private final OtpCodeRepository codes;
    private final OtpSender sender;
    private final Clock clock;

    /** What was sent; {@code code} is the plain code (only ever returned as devCode). */
    public record Issued(Instant expiresAt, Instant resendAt, String code) {
    }

    /**
     * Sends a fresh code, superseding any live one. {@code OTP_RESEND_TOO_SOON} with
     * {@code meta.retryAfter} (seconds) while the previous code's resend window is open.
     */
    @Transactional
    public Issued issue(OtpPurpose purpose, String target, PendingSignup payload) {
        Instant now = clock.instant();
        codes.findFirstByPurposeAndTargetOrderByCreatedAtDesc(purpose, target).ifPresent(prev -> {
            if (prev.getConsumedAt() == null && prev.getExpiresAt().isAfter(now)) {
                if (prev.getResendAt().isAfter(now)) {
                    throw BusinessException.withDetail(StatusCode.OTP_RESEND_TOO_SOON, null,
                            "Wait before requesting another code",
                            Map.of("retryAfter", secondsUntil(now, prev.getResendAt())));
                }
                prev.setConsumedAt(now); // superseded
                codes.save(prev);
            }
        });
        String code = SecureTokens.randomDigits(CODE_LENGTH);
        OtpCode otp = new OtpCode();
        otp.setPurpose(purpose);
        otp.setTarget(target);
        otp.setCodeHash(hash(purpose, target, code));
        otp.setExpiresAt(now.plus(TTL));
        otp.setResendAt(now.plus(RESEND_AFTER));
        otp.setPayload(payload);
        codes.saveAndFlush(otp);
        sender.send(purpose, target, code);
        return new Issued(otp.getExpiresAt(), otp.getResendAt(), code);
    }

    /** The pending sign-up stored with the latest VERIFY code for this email, if any. */
    @Transactional(readOnly = true)
    public PendingSignup pendingSignup(String email) {
        return codes.findFirstByPurposeAndTargetOrderByCreatedAtDesc(OtpPurpose.VERIFY, email)
                .map(OtpCode::getPayload)
                .orElse(null);
    }

    /**
     * Checks {@code code} against the latest code and consumes it on success. Runs in its own
     * transaction so a wrong attempt is counted even though the caller fails.
     *
     * @throws BusinessException {@code OTP_INVALID} ({@code meta.triesLeft}), {@code OTP_EXPIRED},
     *                           {@code OTP_ATTEMPTS_EXCEEDED}
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = BusinessException.class)
    public OtpCode verify(OtpPurpose purpose, String target, String code) {
        Instant now = clock.instant();
        OtpCode otp = codes.findFirstByPurposeAndTargetOrderByCreatedAtDesc(purpose, target)
                .orElseThrow(() -> fail(StatusCode.OTP_EXPIRED, null));
        if (otp.getAttempts() >= MAX_ATTEMPTS) {
            throw fail(StatusCode.OTP_ATTEMPTS_EXCEEDED, null);
        }
        if (otp.getConsumedAt() != null || !otp.getExpiresAt().isAfter(now)) {
            throw fail(StatusCode.OTP_EXPIRED, null);
        }
        boolean wellFormed = code != null && code.matches("\\d{" + CODE_LENGTH + "}");
        if (!wellFormed || !SecureTokens.equalsConstantTime(otp.getCodeHash(), hash(purpose, target, code))) {
            otp.setAttempts(otp.getAttempts() + 1);
            int left = MAX_ATTEMPTS - otp.getAttempts();
            if (left <= 0) {
                otp.setConsumedAt(now);
                codes.save(otp);
                throw fail(StatusCode.OTP_ATTEMPTS_EXCEEDED, null);
            }
            codes.save(otp);
            throw fail(StatusCode.OTP_INVALID, Map.of("triesLeft", left));
        }
        otp.setConsumedAt(now);
        return codes.save(otp);
    }

    static String hash(OtpPurpose purpose, String target, String code) {
        return SecureTokens.sha256Hex(purpose.name() + ':' + target + ':' + code);
    }

    static long secondsUntil(Instant now, Instant then) {
        long ms = Duration.between(now, then).toMillis();
        return Math.max(1, (ms + 999) / 1000);
    }

    private static BusinessException fail(StatusCode code, Map<String, Object> meta) {
        return BusinessException.withDetail(code, "code", code.getMessage(), meta);
    }
}
