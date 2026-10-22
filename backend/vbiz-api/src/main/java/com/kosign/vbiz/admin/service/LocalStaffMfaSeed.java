package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.util.Map;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.repository.MfaRecoveryCodeRepository;
import com.kosign.vbiz.admin.repository.MfaSessionRepository;
import com.kosign.vbiz.common.security.SecretBox;

import lombok.RequiredArgsConstructor;

/**
 * Local profile only. When two-step sign-in is required, the demo staff accounts get known keys
 * (like their known demo password) so a developer and the e2e tests can sign in; add the key to an
 * authenticator app by hand. When it's optional, demo accounts still holding exactly those demo keys
 * are taken off it, so they sign in with their password alone (a key someone set up themselves is
 * left alone). Never runs in dev / uat / prod.
 */
@Profile({"local", "demo"})
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
    private final StaffProperties props;
    private final MfaRecoveryCodeRepository recovery;
    private final MfaSessionRepository mfaSessions;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!props.mfaRequired()) {
            KEYS.forEach((email, key) -> users.findByEmail(email)
                    .filter(u -> u.hasMfa() && key.equals(openOrNull(u.getMfaSecret()))).ifPresent(u -> {
                        u.setMfaSecret(null);
                        u.setMfaEnabledAt(null);
                        u.setMfaLastStep(null);
                        users.saveAndFlush(u);
                        recovery.deleteAllForUser(u.getId());
                        mfaSessions.deleteAllForUser(u.getId());
                    }));
            return;
        }
        KEYS.forEach((email, key) -> users.findByEmail(email).filter(u -> u.isStaff() && !u.hasMfa()).ifPresent(u -> {
            u.setMfaSecret(box.seal(key));
            u.setMfaEnabledAt(clock.instant());
            users.saveAndFlush(u);
        }));
    }

    private String openOrNull(String sealed) {
        try {
            return sealed == null ? null : box.open(sealed);
        } catch (RuntimeException e) {
            return null;
        }
    }
}
