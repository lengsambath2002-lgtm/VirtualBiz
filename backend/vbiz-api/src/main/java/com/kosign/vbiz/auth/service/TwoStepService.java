package com.kosign.vbiz.auth.service;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.payload.MfaSetupResponse;
import com.kosign.vbiz.admin.payload.RecoveryCodesResponse;
import com.kosign.vbiz.auth.domain.AuthTicket;
import com.kosign.vbiz.auth.domain.SignInMethod;
import com.kosign.vbiz.auth.domain.TicketKind;
import com.kosign.vbiz.auth.payload.TwoStepCodeRequest;
import com.kosign.vbiz.auth.payload.TwoStepStatusResponse;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.logging.LogMask;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.common.security.SecretBox;
import com.kosign.vbiz.common.security.Totp;
import com.kosign.vbiz.mail.Email;
import com.kosign.vbiz.mail.EmailSender;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Two-step sign-in for every account (docs/api/two-step.md). Turned on in Your account → Settings
 * with an authenticator app; after that every sign-in (password, email code, Google, phone) asks
 * for a code from the app, or a recovery code, before the session starts. Staff have the same
 * key but manage it in the console, which checks it there instead ({@code MfaService}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TwoStepService {

    public static final int MAX_FAILURES = 5;
    private static final String ISSUER = "VirtualBiz";

    private final UserRepository users;
    private final TwoStepCodes codes;
    private final TicketService tickets;
    private final SecretBox box;
    private final ObjectProvider<EmailSender> mail;
    private final Clock clock;

    // ── Your account ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public TwoStepStatusResponse status() {
        User u = me();
        return new TwoStepStatusResponse(u.hasMfa(), u.hasMfa() ? codes.recoveryLeft(u.getId()) : 0, u.isStaff());
    }

    /** The key to add to the app: the unfinished one if set-up was started, else a new one. */
    @Transactional
    public MfaSetupResponse setup() {
        User u = lockedMe();
        if (u.hasMfa()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "twoStep", "Two-step sign-in is already on");
        }
        String secret;
        if (u.getMfaSecret() != null) {
            secret = box.open(u.getMfaSecret());
        } else {
            secret = Totp.newSecret();
            u.setMfaSecret(box.seal(secret));
            users.saveAndFlush(u);
        }
        String account = u.getEmail() != null ? u.getEmail() : u.getPhone() != null ? u.getPhone() : u.getName();
        return new MfaSetupResponse(secret, Totp.uri(ISSUER, account, secret));
    }

    /** Proves the key with a code from the app: turns it on and returns 10 recovery codes. */
    @Transactional
    public RecoveryCodesResponse enable(String code) {
        User u = lockedMe();
        if (u.hasMfa()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "twoStep", "Two-step sign-in is already on");
        }
        if (u.getMfaSecret() == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "code", "Start the set-up first");
        }
        long step = Totp.match(box.open(u.getMfaSecret()), TwoStepCodes.trim(code), codes.nowStep(), 1);
        if (step < 0) {
            throw BusinessException.withDetail(StatusCode.MFA_CODE_INVALID, "code", "Wrong code");
        }
        u.setMfaEnabledAt(clock.instant());
        u.setMfaLastStep(step);
        users.saveAndFlush(u);
        List<String> plain = codes.newRecoveryCodes(u.getId());
        log.info("[AUTH] Two-step sign-in turned on for user {}", u.getId());
        alert(u, "Two-step sign-in is on", "ការចូលពីរជំហានត្រូវបានបើក",
                "From now on, signing in to VirtualBiz also asks for a code from your authenticator app.");
        return new RecoveryCodesResponse(plain);
    }

    /** Turns it off, with a code from the app or a recovery code (so a stolen session alone can't). */
    @Transactional
    public TwoStepStatusResponse disable(TwoStepCodeRequest in) {
        User u = lockedMe();
        if (!u.hasMfa()) {
            return status();
        }
        if (!codes.use(u, in.code(), in.recoveryCode())) {
            throw BusinessException.withDetail(StatusCode.MFA_CODE_INVALID, "code", "Wrong code");
        }
        u.setMfaSecret(null);
        u.setMfaEnabledAt(null);
        u.setMfaLastStep(null);
        users.saveAndFlush(u);
        codes.deleteRecoveryCodes(u.getId());
        log.info("[AUTH] Two-step sign-in turned off for user {}", u.getId());
        alert(u, "Two-step sign-in is off", "ការចូលពីរជំហានត្រូវបានបិទ",
                "Signing in to VirtualBiz no longer asks for a code from your authenticator app.");
        return status();
    }

    /** New recovery codes (the old ones stop working), with a code from the app. */
    @Transactional
    public RecoveryCodesResponse regenerate(TwoStepCodeRequest in) {
        User u = lockedMe();
        if (!u.hasMfa()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "twoStep", "Two-step sign-in is off");
        }
        if (!codes.useAppCode(u, in.code())) {
            throw BusinessException.withDetail(StatusCode.MFA_CODE_INVALID, "code", "Wrong code");
        }
        return new RecoveryCodesResponse(codes.newRecoveryCodes(u.getId()));
    }

    // ── Sign-in ───────────────────────────────────────────────────────────────────────

    /** Whether this sign-in must stop for a code (staff are checked in the console instead). */
    public boolean required(User u) {
        return u.hasMfa() && !u.isStaff();
    }

    /**
     * The answer to a sign-in that needs a code: TWO_STEP_REQUIRED with a 10-minute ticket
     * ({@code meta.ticket}) for {@code POST /api/auth/two-step}.
     */
    public BusinessException challenge(User u, SignInMethod method) {
        String ticket = tickets.issueSeparately(TicketKind.TWO_STEP, u.getId(), method.name());
        return BusinessException.withDetail(StatusCode.TWO_STEP_REQUIRED, "code",
                "Enter the code from your authenticator app", Map.of("ticket", ticket));
    }

    /**
     * Checks the code against the ticket's account and uses the ticket up. A wrong code counts; the
     * fifth uses the ticket up ({@code MFA_LOCKED}: sign in again). Returns the account and the
     * sign-in method to finish with.
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public Map.Entry<User, SignInMethod> pass(String ticket, String code, String recoveryCode) {
        AuthTicket t = tickets.open(TicketKind.TWO_STEP, ticket, "ticket");
        User u = users.findById(t.getUserId()).orElseThrow(() -> new BusinessException(StatusCode.UNAUTHORIZED));
        if (!u.hasMfa() || codes.use(u, code, recoveryCode)) {
            t.setConsumedAt(clock.instant());
            return Map.entry(u, SignInMethod.valueOf(t.getTarget()));
        }
        t.setFailures((short) (t.getFailures() + 1));
        if (t.getFailures() >= MAX_FAILURES) {
            t.setConsumedAt(clock.instant());
            log.warn("[AUTH] {} wrong two-step codes for user {}; the sign-in has to start again", MAX_FAILURES,
                    u.getId());
            throw new BusinessException(StatusCode.MFA_LOCKED);
        }
        throw BusinessException.withDetail(StatusCode.MFA_CODE_INVALID, "code", "Wrong code",
                Map.of("attemptsLeft", MAX_FAILURES - t.getFailures()));
    }

    private void alert(User u, String subject, String headingKh, String line) {
        EmailSender sender = mail.getIfAvailable();
        if (sender == null || u.getEmail() == null) {
            return;
        }
        sender.send(u.getEmail(), subject, new Email()
                .preheader(line)
                .badge("VirtualBiz", null)
                .heading(subject)
                .line(line)
                .small("Wasn't you? Change your password and contact us through the Help page.")
                .divider()
                .heading(headingKh)
                .small("បើមិនមែនជាអ្នកទេ សូមប្តូរពាក្យសម្ងាត់ ហើយទាក់ទងយើងតាមទំព័រជំនួយ។"));
        log.debug("[AUTH] Two-step alert sent to {}", LogMask.contact(u.getEmail()));
    }

    private User me() {
        return users.findById(CurrentUser.id()).orElseThrow(() -> new BusinessException(StatusCode.UNAUTHORIZED));
    }

    private User lockedMe() {
        UUID id = CurrentUser.id();
        User u = users.findByIdForUpdate(id).orElseThrow(() -> new BusinessException(StatusCode.UNAUTHORIZED));
        if (u.isStaff()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "twoStep",
                    "Staff turn two-step sign-in on and off in the console");
        }
        return u;
    }
}
