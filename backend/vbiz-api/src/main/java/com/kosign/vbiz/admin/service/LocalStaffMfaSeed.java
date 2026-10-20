package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.util.Map;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.common.security.SecretBox;

import lombok.RequiredArgsConstructor;

/**
 * Local profile only: the demo staff accounts use two-step sign-in with known keys, like their
 * known demo password, so a developer (and the e2e tests) can sign in. Add the key to an
 * authenticator app by hand. Never runs in dev / uat / prod.
 */
@Profile("local")
@Component
@RequiredArgsConstructor
public class LocalStaffMfaSeed implements ApplicationRunner {

    /** Demo staff email → Base32 TOTP key (docs/api/phase9-staff-security.md § Local). */
    public static final Map<String, String> KEYS = Map.of(
            "admin@virtualbiz.com", "VBIZADMINLOCALDEMOSECRETKEYZZZZZ",
            "support@virtualbiz.com", "VBIZSUPPORTLOCALDEMOSECRETKEYZZZ");

    private final UserRepository users;
    private final SecretBox box;
    private final Clock clock;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        KEYS.forEach((email, key) -> users.findByEmail(email).filter(u -> u.isStaff() && !u.hasMfa()).ifPresent(u -> {
            u.setMfaSecret(box.seal(key));
            u.setMfaEnabledAt(clock.instant());
            users.saveAndFlush(u);
        }));
    }
}
