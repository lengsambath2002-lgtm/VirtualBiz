package com.kosign.vbiz.admin.service;

import java.util.Map;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.domain.AuditTarget;
import com.kosign.vbiz.auth.domain.SignInMethod;
import com.kosign.vbiz.auth.service.PasswordPolicy;
import com.kosign.vbiz.common.helper.Emails;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * First start of a new environment: with no active super-admin, creates one from
 * {@code vbiz.staff.bootstrap.*} (VBIZ_BOOTSTRAP_ADMIN_*), or promotes the account with that
 * email. The password must meet the staff rules and is temporary: the console asks for a new
 * one, then for two-step sign-in. Does nothing once a super-admin exists, so the variables can
 * stay set safely (but should be removed).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StaffBootstrap implements ApplicationRunner {

    private final StaffProperties props;
    private final UserRepository users;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final AuditLog audit;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.countByPlatformRoleAndSuspendedAtIsNull(PlatformRole.SUPER_ADMIN) > 0) {
            return;
        }
        StaffProperties.Bootstrap b = props.bootstrap();
        if (b == null || b.email() == null || b.email().isBlank()) {
            log.warn("[STAFF] There is no active super-admin. Set VBIZ_BOOTSTRAP_ADMIN_EMAIL and "
                    + "VBIZ_BOOTSTRAP_ADMIN_PASSWORD and restart to create the first one.");
            return;
        }
        String email = Emails.normalizeOrThrow(b.email(), "VBIZ_BOOTSTRAP_ADMIN_EMAIL");
        if (b.password() == null || passwordPolicy.violations(b.password(), email).size() > 0
                || b.password().length() < PasswordPolicy.STAFF_MIN_LENGTH) {
            throw new IllegalStateException("VBIZ_BOOTSTRAP_ADMIN_PASSWORD must have 12+ characters with upper and "
                    + "lower case, a digit and a symbol, and not contain the email's name");
        }
        User u = users.findByEmail(email).orElseGet(() -> User.create(
                b.name() == null || b.name().isBlank() ? "VirtualBiz Admin" : b.name().trim(), email, null));
        if (u.isSuspended()) {
            log.error("[STAFF] Bootstrap account {} is suspended; not promoting it", email);
            return;
        }
        u.setPasswordHash(passwordEncoder.encode(b.password()));
        u.addSignInMethod(SignInMethod.PASSWORD);
        u.setPlatformRole(PlatformRole.SUPER_ADMIN);
        u.setMustChangePassword(true);
        u = users.saveAndFlush(u);
        audit.record(new AdminAccess.Admin(null, "System", null), AuditLog.STAFF_BOOTSTRAPPED, AuditTarget.USER,
                u.getId(), u.getName(), null, Map.of("email", email));
        log.warn("[STAFF] Created the first super-admin {} from VBIZ_BOOTSTRAP_ADMIN_*. Sign in, change the "
                + "password and set up two-step sign-in; then remove the variables.", email);
    }
}
