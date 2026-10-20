package com.kosign.vbiz.auth.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.mapper.AccountMapper;
import com.kosign.vbiz.account.service.UserService;
import com.kosign.vbiz.auth.domain.AuthTicket;
import com.kosign.vbiz.auth.domain.OtpPurpose;
import com.kosign.vbiz.auth.domain.PendingSignup;
import com.kosign.vbiz.auth.domain.SignInMethod;
import com.kosign.vbiz.auth.domain.TicketKind;
import com.kosign.vbiz.auth.payload.AuthResult;
import com.kosign.vbiz.auth.payload.AuthSessionResponse;
import com.kosign.vbiz.auth.payload.LookupResponse;
import com.kosign.vbiz.auth.payload.OtpSentResponse;
import com.kosign.vbiz.auth.payload.PhoneVerifyResponse;
import com.kosign.vbiz.auth.payload.PhoneVerifyResult;
import com.kosign.vbiz.auth.payload.ResetTokenResponse;
import com.kosign.vbiz.auth.service.GoogleTokenVerifier.GoogleIdentity;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Emails;
import com.kosign.vbiz.common.helper.PhoneNumbers;
import com.kosign.vbiz.common.security.IssuedToken;
import com.kosign.vbiz.common.security.JwtTokenService;

import lombok.RequiredArgsConstructor;

/**
 * Sign-in flows from the Sign-in prototype: email + password, email code, password reset,
 * phone SMS, Google, plus refresh / log out. Each successful sign-in starts a refresh-token
 * session and returns an access token.
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService users;
    private final OtpService otp;
    private final SessionService sessions;
    private final TicketService tickets;
    private final LoginAttemptService loginAttempts;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwt;
    private final GoogleTokenVerifier google;
    private final OtpProperties otpProps;
    private final AuthProperties authProps;

    // ── Lookup / password ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public LookupResponse lookup(String rawEmail) {
        String email = Emails.normalizeOrThrow(rawEmail, "email");
        return users.findByEmail(email)
                .map(u -> new LookupResponse(true, u.getSignInMethods().stream().sorted().toList()))
                .orElseGet(() -> new LookupResponse(false, List.of()));
    }

    @Transactional
    public AuthResult login(String rawEmail, String password, ClientInfo client) {
        String email = Emails.normalizeOrThrow(rawEmail, "email");
        User user = users.findByEmail(email).orElseThrow(() -> BusinessException.withDetail(
                StatusCode.INVALID_CREDENTIALS, "email", "No account for this email", Map.of("reason", "NO_ACCOUNT")));
        loginAttempts.assertNotLocked(user);
        if (!user.hasPassword() || !passwordEncoder.matches(password, user.getPasswordHash())) {
            loginAttempts.recordFailure(user.getId()); // always throws
        }
        loginAttempts.reset(user);
        return signIn(user, SignInMethod.PASSWORD, client);
    }

    // ── Codes ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public OtpSentResponse sendOtp(OtpPurpose purpose, String to) {
        return switch (purpose) {
            case PHONE -> sent(otp.issue(OtpPurpose.PHONE, PhoneNumbers.normalizeOrThrow(to), null));
            case LOGIN, RESET -> {
                String email = Emails.normalizeOrThrow(to, "to");
                if (users.findByEmail(email).isEmpty()) {
                    throw BusinessException.withDetail(StatusCode.USER_NOT_FOUND, "to", "No account for this email");
                }
                yield sent(otp.issue(purpose, email, null));
            }
            case VERIFY -> {
                // Resend for a pending sign-up: the new code carries the same pending details.
                String email = Emails.normalizeOrThrow(to, "to");
                if (users.emailTaken(email)) {
                    throw BusinessException.withDetail(StatusCode.CONFLICT, "email", "Email already registered");
                }
                PendingSignup pending = otp.pendingSignup(email);
                if (pending == null) {
                    throw BusinessException.withDetail(StatusCode.NOT_FOUND, "to", "No sign-up waiting for this email");
                }
                yield sent(otp.issue(OtpPurpose.VERIFY, email, pending));
            }
        };
    }

    // ── Sign-up ───────────────────────────────────────────────────────────────────────

    @Transactional
    public OtpSentResponse signup(String rawName, String rawEmail, String password) {
        String email = Emails.normalizeOrThrow(rawEmail, "email");
        String name = requireName(rawName);
        if (users.emailTaken(email)) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "email", "Email already registered");
        }
        passwordPolicy.check(password, email, "password");
        PendingSignup pending = new PendingSignup(name, passwordEncoder.encode(password));
        return sent(otp.issue(OtpPurpose.VERIFY, email, pending));
    }

    @Transactional
    public AuthResult verifySignup(String rawEmail, String code, ClientInfo client) {
        String email = Emails.normalizeOrThrow(rawEmail, "email");
        PendingSignup pending = otp.verify(OtpPurpose.VERIFY, email, code).getPayload();
        if (pending == null) {
            throw BusinessException.withDetail(StatusCode.OTP_EXPIRED, "code", "No sign-up waiting for this code");
        }
        if (users.emailTaken(email)) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "email", "Email already registered");
        }
        User user = User.create(pending.name(), email, null);
        user.setPasswordHash(pending.passwordHash());
        return signIn(user, SignInMethod.PASSWORD, client);
    }

    // ── Email code / reset ────────────────────────────────────────────────────────────

    @Transactional
    public AuthResult loginWithCode(String rawEmail, String code, ClientInfo client) {
        String email = Emails.normalizeOrThrow(rawEmail, "email");
        otp.verify(OtpPurpose.LOGIN, email, code);
        User user = users.findByEmail(email).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
        loginAttempts.reset(user); // signing in by code also lifts the password lock
        return signIn(user, SignInMethod.EMAIL_CODE, client);
    }

    @Transactional
    public ResetTokenResponse verifyReset(String rawEmail, String code) {
        String email = Emails.normalizeOrThrow(rawEmail, "email");
        otp.verify(OtpPurpose.RESET, email, code);
        User user = users.findByEmail(email).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
        return new ResetTokenResponse(tickets.issue(TicketKind.RESET, user.getId(), email));
    }

    /** Sets the new password, ends every other session and signs in. */
    @Transactional
    public AuthResult resetPassword(String resetToken, String password, ClientInfo client) {
        AuthTicket ticket = tickets.consume(TicketKind.RESET, resetToken, "resetToken");
        User current = users.require(ticket.getUserId());
        passwordPolicy.check(password, current.getEmail(), "password", current.isStaff());
        if (current.hasPassword() && passwordEncoder.matches(password, current.getPasswordHash())) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "password",
                    "Password was used before");
        }
        // Bulk revoke clears the persistence context, so load the user afterwards.
        sessions.revokeAll(ticket.getUserId());
        User user = users.require(ticket.getUserId());
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setMustChangePassword(false);
        loginAttempts.reset(user);
        return signIn(user, SignInMethod.PASSWORD, client);
    }

    // ── Phone ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public PhoneVerifyResult verifyPhone(String rawPhone, String code, ClientInfo client) {
        String phone = PhoneNumbers.normalizeOrThrow(rawPhone);
        otp.verify(OtpPurpose.PHONE, phone, code);
        return users.findByPhone(phone)
                .map(user -> {
                    AuthResult r = signIn(user, SignInMethod.PHONE_SMS, client);
                    return new PhoneVerifyResult(
                            new PhoneVerifyResponse(PhoneVerifyResponse.SIGNED_IN, r.session(), null),
                            r.refreshToken());
                })
                .orElseGet(() -> new PhoneVerifyResult(
                        new PhoneVerifyResponse(PhoneVerifyResponse.NEW, null,
                                tickets.issue(TicketKind.PHONE, null, phone)),
                        null));
    }

    @Transactional
    public AuthResult registerPhone(String phoneToken, String rawName, String rawEmail, ClientInfo client) {
        AuthTicket ticket = tickets.consume(TicketKind.PHONE, phoneToken, "phoneToken");
        String phone = ticket.getTarget();
        String name = requireName(rawName);
        String email = rawEmail == null || rawEmail.isBlank() ? null : Emails.normalizeOrThrow(rawEmail, "email");
        if (users.phoneTaken(phone)) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "phone", "Phone number already registered");
        }
        if (users.emailTaken(email)) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "email", "Email already registered");
        }
        return signIn(User.create(name, email, phone), SignInMethod.PHONE_SMS, client);
    }

    // ── Google ────────────────────────────────────────────────────────────────────────

    @Transactional
    public AuthResult google(String idToken, ClientInfo client) {
        GoogleIdentity id = google.verify(idToken);
        return googleSignIn(Emails.normalizeOrThrow(id.email(), "idToken"), id.name(), id.picture(), client);
    }

    /** Local/dev stand-in for Google. {@code NOT_FOUND} unless {@code vbiz.auth.google-dev-enabled}. */
    @Transactional
    public AuthResult googleDev(String rawEmail, String name, ClientInfo client) {
        if (!authProps.googleDevEnabled()) {
            throw new BusinessException(StatusCode.NOT_FOUND);
        }
        return googleSignIn(Emails.normalizeOrThrow(rawEmail, "email"), name, null, client);
    }

    private AuthResult googleSignIn(String email, String name, String picture, ClientInfo client) {
        User user = users.findByEmail(email).orElseGet(() -> User.create(
                name == null || name.isBlank() ? Emails.localPart(email) : truncate(name.trim(), 80), email, null));
        if (user.getAvatarUrl() == null && picture != null && picture.length() <= 500) {
            user.setAvatarUrl(picture);
        }
        return signIn(user, SignInMethod.GOOGLE, client);
    }

    // ── Session ───────────────────────────────────────────────────────────────────────

    /** Rotates the refresh token. Not transactional itself: a detected reuse must stay revoked. */
    public AuthResult refresh(String refreshToken, ClientInfo client) {
        SessionService.Started next = sessions.rotate(refreshToken, client);
        User user = users.require(next.userId());
        requireNotSuspended(user);
        return new AuthResult(session(user, next.sessionId()), next.refreshToken());
    }

    public void logout(String refreshToken) {
        sessions.revoke(refreshToken);
    }

    public void logoutAll(UUID userId) {
        sessions.revokeAll(userId);
    }

    /** Signs in an account that just accepted an invite (staff or shop team; its password was checked or set there). */
    @Transactional
    public AuthResult signInAfterInvite(User user, ClientInfo client) {
        return signIn(user, SignInMethod.PASSWORD, client);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────────

    private AuthResult signIn(User user, SignInMethod method, ClientInfo client) {
        requireNotSuspended(user);
        user.addSignInMethod(method);
        User saved = users.save(user);
        SessionService.Started started = sessions.start(saved.getId(), client);
        return new AuthResult(session(saved, started.sessionId()), started.refreshToken());
    }

    private AuthSessionResponse session(User user, UUID sessionId) {
        IssuedToken token = jwt.issue(user.getId(), sessionId);
        return new AuthSessionResponse(token.token(), token.expiresIn(), AccountMapper.toUser(user));
    }

    /** A suspended account is told so (after its credentials were checked), never signed in. */
    private static void requireNotSuspended(User user) {
        if (user.isSuspended()) {
            throw new BusinessException(StatusCode.ACCOUNT_SUSPENDED);
        }
    }

    private OtpSentResponse sent(OtpService.Issued issued) {
        return new OtpSentResponse(issued.expiresAt(), issued.resendAt(),
                otpProps.exposeDevCode() ? issued.code() : null);
    }

    private static String requireName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "Name is required");
        }
        return truncate(name, 80);
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
