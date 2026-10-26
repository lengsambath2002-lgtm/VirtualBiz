package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.domain.MfaSession;
import com.kosign.vbiz.admin.payload.MfaCodeInput;
import com.kosign.vbiz.admin.payload.MfaSetupResponse;
import com.kosign.vbiz.admin.payload.MfaStatusResponse;
import com.kosign.vbiz.admin.payload.RecoveryCodesResponse;
import com.kosign.vbiz.admin.repository.MfaRecoveryCodeRepository;
import com.kosign.vbiz.admin.repository.MfaSessionRepository;
import com.kosign.vbiz.auth.repository.UserSessionRepository;
import com.kosign.vbiz.auth.service.TwoStepCodes;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.common.security.SecretBox;
import com.kosign.vbiz.common.security.Totp;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Staff two-step sign-in (docs/api/phase9-staff-security.md): set up a TOTP key, prove it with a
 * code (which also passes this sign-in's check and returns 10 recovery codes), then pass the
 * check on each new sign-in with a code or a recovery code. Five wrong codes sign the session
 * out. Codes can't be replayed (the last accepted time step is kept).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MfaService {

    public static final int RECOVERY_CODES = TwoStepCodes.RECOVERY_CODES;
    public static final int MAX_FAILURES = 5;
    private static final String ISSUER = "VirtualBiz";

    private final UserRepository users;
    private final MfaRecoveryCodeRepository recovery;
    private final MfaSessionRepository mfaSessions;
    private final UserSessionRepository sessions;
    private final StaffGate gate;
    private final StaffProperties props;
    private final SecretBox box;
    private final AuditLog audit;
    private final TwoStepCodes codes;
    private final Clock clock;

    @Transactional(readOnly = true)
    public MfaStatusResponse status() {
        User u = me();
        if (!u.isStaff()) {
            return new MfaStatusResponse(false, false, false, false, false, null, 0);
        }
        Instant until = gate.verifiedUntil(u.getId()).filter(t -> t.isAfter(clock.instant())).orElse(null);
        return new MfaStatusResponse(true, u.isMustChangePassword(), props.mfaRequired(), u.hasMfa(), until != null,
                until, recovery.countByUserIdAndUsedAtIsNull(u.getId()));
    }

    /**
     * The key to add to the app: the unfinished one if set-up was already started (so a reload or
     * a second tab shows the QR already scanned), else a new one. {@code CONFLICT} once on.
     */
    @Transactional
    public MfaSetupResponse setup() {
        User u = users.findByIdForUpdate(CurrentUser.id())
                .orElseThrow(() -> new BusinessException(StatusCode.UNAUTHORIZED));
        if (!u.isStaff() || u.isSuspended()) {
            throw new BusinessException(StatusCode.ADMIN_ONLY);
        }
        if (u.hasMfa()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "mfa", "Two-step sign-in is already on");
        }
        String secret;
        if (u.getMfaSecret() != null) {
            secret = box.open(u.getMfaSecret());
        } else {
            secret = Totp.newSecret();
            u.setMfaSecret(box.seal(secret));
            users.saveAndFlush(u);
        }
        String account = u.getEmail() != null ? u.getEmail() : u.getName();
        return new MfaSetupResponse(secret, Totp.uri(ISSUER, account, secret));
    }

    /** Proves the new key with a code: turns two-step sign-in on and passes this sign-in's check. */
    @Transactional
    public RecoveryCodesResponse enable(String code) {
        User u = staff();
        if (u.hasMfa()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "mfa", "Two-step sign-in is already on");
        }
        if (u.getMfaSecret() == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "code", "Start the set-up first");
        }
        long step = Totp.match(box.open(u.getMfaSecret()), trim(code), nowStep(), 1);
        if (step < 0) {
            throw BusinessException.withDetail(StatusCode.MFA_CODE_INVALID, "code", "Wrong code");
        }
        Instant now = clock.instant();
        u.setMfaEnabledAt(now);
        u.setMfaLastStep(step);
        users.saveAndFlush(u);
        List<String> codes = newRecoveryCodes(u.getId());
        markVerified(u.getId());
        audit.record(self(u), AuditLog.MFA_ENABLED, AuditTarget.USER, u.getId(), u.getName(), null, null);
        return new RecoveryCodesResponse(codes);
    }

    /**
     * Passes this sign-in's check with an authenticator code or a recovery code. A wrong one
     * counts; the fifth signs this session out ({@code MFA_LOCKED}).
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public MfaStatusResponse verify(MfaCodeInput in) {
        User u = staff();
        if (!u.hasMfa()) {
            throw new BusinessException(StatusCode.MFA_SETUP_REQUIRED);
        }
        UUID family = gate.currentFamily().orElseThrow(() -> new BusinessException(StatusCode.UNAUTHORIZED));
        MfaSession s = mfaSessions.findById(family).orElseGet(() -> {
            MfaSession n = new MfaSession();
            n.setFamilyId(family);
            n.setUserId(u.getId());
            return n;
        });
        if (s.getFailures() >= MAX_FAILURES) {
            locked(family);
        }
        boolean ok;
        if (in.recoveryCode() != null && !in.recoveryCode().isBlank()) {
            ok = useRecoveryCode(u, in.recoveryCode());
        } else {
            long step = Totp.match(box.open(u.getMfaSecret()), trim(in.code()), nowStep(), 1);
            ok = step >= 0 && (u.getMfaLastStep() == null || step > u.getMfaLastStep());
            if (ok) {
                u.setMfaLastStep(step);
                users.save(u);
            }
        }
        if (!ok) {
            s.setFailures(s.getFailures() + 1);
            mfaSessions.saveAndFlush(s);
            if (s.getFailures() >= MAX_FAILURES) {
                log.warn("[STAFF] {} wrong two-step codes for user {}; signing the session out", MAX_FAILURES,
                        u.getId());
                locked(family);
            }
            throw BusinessException.withDetail(StatusCode.MFA_CODE_INVALID, "code", "Wrong code",
                    Map.of("attemptsLeft", MAX_FAILURES - s.getFailures()));
        }
        s.setFailures(0);
        s.setVerifiedAt(clock.instant());
        mfaSessions.saveAndFlush(s);
        return status();
    }

    /** New recovery codes (the old ones stop working). Needs this sign-in's check passed. */
    @Transactional
    public RecoveryCodesResponse regenerate() {
        User u = staff();
        if (!u.hasMfa()) {
            throw new BusinessException(StatusCode.MFA_SETUP_REQUIRED);
        }
        gate.check(u);
        List<String> codes = newRecoveryCodes(u.getId());
        audit.record(self(u), AuditLog.MFA_RECOVERY_REGENERATED, AuditTarget.USER, u.getId(), u.getName(), null,
                null);
        return new RecoveryCodesResponse(codes);
    }

    /**
     * Turns two-step sign-in off for {@code target} (a lost phone): they set it up again at their
     * next console visit. Their sessions end. The caller checks who may do this.
     */
    @Transactional
    public void reset(AdminAccess.Admin by, User target, String reason) {
        target.setMfaSecret(null);
        target.setMfaEnabledAt(null);
        target.setMfaLastStep(null);
        users.saveAndFlush(target);
        recovery.deleteAllForUser(target.getId());
        mfaSessions.deleteAllForUser(target.getId());
        int revoked = sessions.revokeAllForUser(target.getId(), clock.instant());
        audit.record(by, AuditLog.STAFF_MFA_RESET, AuditTarget.USER, target.getId(), target.getName(), reason,
                Map.of("sessionsRevoked", revoked));
    }

    private boolean useRecoveryCode(User u, String raw) {
        if (!codes.useRecoveryCode(u, raw)) {
            return false;
        }
        audit.record(self(u), AuditLog.MFA_RECOVERY_USED, AuditTarget.USER, u.getId(), u.getName(), null,
                Map.of("left", codes.recoveryLeft(u.getId())));
        return true;
    }

    private List<String> newRecoveryCodes(UUID userId) {
        return codes.newRecoveryCodes(userId);
    }

    private void markVerified(UUID userId) {
        gate.currentFamily().ifPresent(family -> {
            MfaSession s = mfaSessions.findById(family).orElseGet(MfaSession::new);
            s.setFamilyId(family);
            s.setUserId(userId);
            s.setFailures(0);
            s.setVerifiedAt(clock.instant());
            mfaSessions.saveAndFlush(s);
        });
    }

    private void locked(UUID family) {
        sessions.revokeFamily(family, clock.instant());
        throw new BusinessException(StatusCode.MFA_LOCKED);
    }

    private long nowStep() {
        return Totp.step(clock.instant().getEpochSecond());
    }

    private User me() {
        return users.findById(CurrentUser.id()).orElseThrow(() -> new BusinessException(StatusCode.UNAUTHORIZED));
    }

    private User staff() {
        User u = me();
        if (!u.isStaff() || u.isSuspended()) {
            throw new BusinessException(StatusCode.ADMIN_ONLY);
        }
        return u;
    }

    private static AdminAccess.Admin self(User u) {
        return new AdminAccess.Admin(u.getId(), u.getName(), u.getPlatformRole());
    }

    private static String trim(String code) {
        return code == null ? "" : code.replaceAll("\\s", "");
    }
}
