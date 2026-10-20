package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.admin.domain.StaffInvite;
import com.kosign.vbiz.admin.payload.InviteAcceptInput;
import com.kosign.vbiz.admin.payload.InvitePreviewResponse;
import com.kosign.vbiz.admin.payload.StaffInviteInput;
import com.kosign.vbiz.admin.payload.StaffInviteResponse;
import com.kosign.vbiz.admin.repository.StaffInviteRepository;
import com.kosign.vbiz.auth.domain.SignInMethod;
import com.kosign.vbiz.auth.payload.AuthResult;
import com.kosign.vbiz.auth.service.AuthService;
import com.kosign.vbiz.auth.service.ClientInfo;
import com.kosign.vbiz.auth.service.LoginAttemptService;
import com.kosign.vbiz.auth.service.PasswordPolicy;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Emails;
import com.kosign.vbiz.common.security.SecureTokens;

import lombok.RequiredArgsConstructor;

/**
 * Staff invites (docs/api/phase9-staff-security.md § Invites). A super-admin invites an email
 * with a role; the link (emailed, single use, {@code vbiz.staff.invite-ttl}) lets that person
 * create an account or confirm their existing one with its password, and join as staff. They
 * then set up two-step sign-in at their first console visit.
 */
@Service
@RequiredArgsConstructor
public class StaffInviteService {

    public static final String PATH = "/staff-invite/";

    private final AdminAccess access;
    private final AuditLog audit;
    private final StaffInviteRepository invites;
    private final UserRepository users;
    private final StaffMailer mailer;
    private final StaffProperties props;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttempts;
    private final AuthService auth;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<StaffInviteResponse> open() {
        access.require();
        Instant now = clock.instant();
        return invites.findByAcceptedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc().stream()
                .map(i -> view(i, now, null)).toList();
    }

    /** A new invite (withdrawing an earlier open one for the same email). */
    @Transactional
    public StaffInviteResponse invite(StaffInviteInput in) {
        AdminAccess.Admin admin = access.requireSuper();
        String email = Emails.normalizeOrThrow(in.email(), "email");
        String name = in.name().trim();
        if (name.length() < 2 || name.length() > 80) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "2–80 characters");
        }
        users.findByEmail(email).filter(User::isStaff).ifPresent(u -> {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "email", "Already on the staff");
        });
        Instant now = clock.instant();
        invites.findByEmailAndAcceptedAtIsNullAndRevokedAtIsNull(email).ifPresent(old -> {
            old.setRevokedAt(now);
            invites.saveAndFlush(old);
        });
        String token = SecureTokens.randomToken();
        StaffInvite i = new StaffInvite();
        i.setEmail(email);
        i.setName(name);
        i.setRole(in.role());
        i.setTokenHash(SecureTokens.sha256Hex(token));
        i.setInvitedBy(admin.id());
        i.setInvitedByName(admin.name());
        i.setExpiresAt(now.plus(props.inviteTtl()));
        invites.saveAndFlush(i);
        audit.record(admin, AuditLog.STAFF_INVITED, AuditTarget.STAFF_INVITE, i.getId(), email, null,
                Map.of("role", in.role().name()));
        mailer.sendInvite(email, name, admin.name(), in.role().name(), props.appUrl() + "/en" + PATH + token);
        return view(i, now, props.exposeDevLinks() ? PATH + token : null);
    }

    @Transactional
    public void revoke(UUID id) {
        AdminAccess.Admin admin = access.requireSuper();
        StaffInvite i = invites.findById(id).orElseThrow(() -> new BusinessException(StatusCode.INVITE_NOT_FOUND));
        if (i.getAcceptedAt() != null || i.getRevokedAt() != null) {
            throw new BusinessException(StatusCode.INVITE_EXPIRED);
        }
        i.setRevokedAt(clock.instant());
        invites.saveAndFlush(i);
        audit.record(admin, AuditLog.STAFF_INVITE_REVOKED, AuditTarget.STAFF_INVITE, id, i.getEmail(), null, null);
    }

    /** Public: what the link offers. */
    @Transactional(readOnly = true)
    public InvitePreviewResponse preview(String token) {
        StaffInvite i = openInvite(token);
        User existing = users.findByEmail(i.getEmail()).orElse(null);
        return new InvitePreviewResponse(i.getEmail(), i.getName(), i.getRole(), i.getInvitedByName(),
                i.getExpiresAt(), existing != null, existing != null && existing.hasPassword());
    }

    /**
     * Public: joins the staff and signs in. An existing account proves it is theirs with its
     * password (a weak one must be changed before the console opens); a new one is created with
     * a staff-strength password.
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public AuthResult accept(String token, InviteAcceptInput in, ClientInfo client) {
        StaffInvite i = openInvite(token);
        String password = in.password();
        User u = users.findByEmail(i.getEmail()).orElse(null);
        if (u != null && u.hasPassword()) {
            loginAttempts.assertNotLocked(u);
            if (!passwordEncoder.matches(password, u.getPasswordHash())) {
                loginAttempts.recordFailure(u.getId()); // throws INVALID_CREDENTIALS
            }
            loginAttempts.reset(u);
            u.setMustChangePassword(!passwordPolicy.violations(password, u.getEmail()).isEmpty()
                    || password.length() < PasswordPolicy.STAFF_MIN_LENGTH);
        } else {
            passwordPolicy.check(password, i.getEmail(), "password", true);
            if (u == null) {
                String name = in.name() == null || in.name().isBlank() ? i.getName() : in.name().trim();
                u = User.create(name.length() > 80 ? name.substring(0, 80) : name, i.getEmail(), null);
            }
            u.setPasswordHash(passwordEncoder.encode(password));
            u.addSignInMethod(SignInMethod.PASSWORD);
        }
        if (u.isSuspended()) {
            throw new BusinessException(StatusCode.ACCOUNT_SUSPENDED);
        }
        u.setPlatformRole(i.getRole());
        u = users.saveAndFlush(u);
        i.setAcceptedAt(clock.instant());
        i.setAcceptedUserId(u.getId());
        invites.saveAndFlush(i);
        audit.record(new AdminAccess.Admin(u.getId(), u.getName(), u.getPlatformRole()), AuditLog.STAFF_JOINED,
                AuditTarget.USER, u.getId(), u.getName(), null,
                Map.of("role", i.getRole().name(), "invitedBy", i.getInvitedByName()));
        return auth.signInAfterInvite(u, client);
    }

    private StaffInvite openInvite(String token) {
        StaffInvite i = invites.findByTokenHash(SecureTokens.sha256Hex(token == null ? "" : token))
                .orElseThrow(() -> new BusinessException(StatusCode.INVITE_NOT_FOUND));
        if (!i.isOpen(clock.instant())) {
            throw new BusinessException(StatusCode.INVITE_EXPIRED);
        }
        return i;
    }

    private static StaffInviteResponse view(StaffInvite i, Instant now, String devLink) {
        return new StaffInviteResponse(i.getId().toString(), i.getEmail(), i.getName(), i.getRole(),
                i.getInvitedByName(), i.getCreatedAt(), i.getExpiresAt(), !i.getExpiresAt().isAfter(now), devLink);
    }
}
