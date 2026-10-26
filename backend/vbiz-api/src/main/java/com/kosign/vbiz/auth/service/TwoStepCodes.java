package com.kosign.vbiz.auth.service;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.domain.MfaRecoveryCode;
import com.kosign.vbiz.admin.repository.MfaRecoveryCodeRepository;
import com.kosign.vbiz.common.security.SecretBox;
import com.kosign.vbiz.common.security.SecureTokens;
import com.kosign.vbiz.common.security.Totp;

import lombok.RequiredArgsConstructor;

/**
 * Checks two-step codes for any account (staff in the console, everyone at sign-in): an
 * authenticator code (never the same one twice) or a one-time recovery code, and makes new
 * recovery codes (only their hashes are kept).
 */
@Component
@RequiredArgsConstructor
public class TwoStepCodes {

    public static final int RECOVERY_CODES = 10;
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final MfaRecoveryCodeRepository recovery;
    private final SecretBox box;
    private final Clock clock;

    /** The authenticator code matches the key (±30 s) and is newer than the last one used. */
    @Transactional
    public boolean useAppCode(User u, String code) {
        if (u.getMfaSecret() == null) {
            return false;
        }
        long step = Totp.match(box.open(u.getMfaSecret()), trim(code), nowStep(), 1);
        if (step < 0 || (u.getMfaLastStep() != null && step <= u.getMfaLastStep())) {
            return false;
        }
        u.setMfaLastStep(step);
        users.save(u);
        return true;
    }

    /** The recovery code is one of the account's unused ones; it is used up. */
    @Transactional
    public boolean useRecoveryCode(User u, String raw) {
        String hash = SecureTokens.sha256Hex(normalise(raw));
        for (MfaRecoveryCode c : recovery.findByUserIdAndUsedAtIsNull(u.getId())) {
            if (SecureTokens.equalsConstantTime(c.getCodeHash(), hash)) {
                c.setUsedAt(clock.instant());
                recovery.saveAndFlush(c);
                return true;
            }
        }
        return false;
    }

    /** An authenticator code, or else a recovery code. */
    @Transactional
    public boolean use(User u, String code, String recoveryCode) {
        return recoveryCode != null && !recoveryCode.isBlank() ? useRecoveryCode(u, recoveryCode)
                : useAppCode(u, code);
    }

    public long recoveryLeft(UUID userId) {
        return recovery.countByUserIdAndUsedAtIsNull(userId);
    }

    /** Replaces the account's recovery codes; returns the new ones (shown once). */
    @Transactional
    public List<String> newRecoveryCodes(UUID userId) {
        recovery.deleteAllForUser(userId);
        List<String> plain = new ArrayList<>();
        List<MfaRecoveryCode> rows = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODES; i++) {
            StringBuilder b = new StringBuilder();
            for (int k = 0; k < 10; k++) {
                b.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            }
            String code = b.substring(0, 5) + "-" + b.substring(5);
            plain.add(code);
            MfaRecoveryCode c = new MfaRecoveryCode();
            c.setUserId(userId);
            c.setCodeHash(SecureTokens.sha256Hex(normalise(code)));
            rows.add(c);
        }
        recovery.saveAll(rows);
        return plain;
    }

    @Transactional
    public void deleteRecoveryCodes(UUID userId) {
        recovery.deleteAllForUser(userId);
    }

    public long nowStep() {
        return Totp.step(clock.instant().getEpochSecond());
    }

    static String normalise(String code) {
        return code == null ? "" : code.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    }

    static String trim(String code) {
        return code == null ? "" : code.replaceAll("\\s", "");
    }
}
