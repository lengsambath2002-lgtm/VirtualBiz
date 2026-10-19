package com.kosign.vbiz.auth.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Emails;

/**
 * Sign-in prototype password rules: at least 8 characters, upper and lower case, a digit, a
 * symbol, and it must not contain the email's name part. Mirrors
 * {@code frontend/src/features/auth/util/rules.ts}.
 */
@Component
public class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 72; // BCrypt only reads 72 bytes

    /** Rule keys the client already translates: len, case, num, sym, email. */
    public List<String> violations(String password, String email) {
        List<String> failed = new ArrayList<>();
        String p = password == null ? "" : password;
        if (p.length() < MIN_LENGTH || p.length() > MAX_LENGTH) {
            failed.add("len");
        }
        if (!p.matches(".*[a-z].*") || !p.matches(".*[A-Z].*")) {
            failed.add("case");
        }
        if (!p.matches(".*\\d.*")) {
            failed.add("num");
        }
        if (!p.matches(".*[^A-Za-z0-9].*")) {
            failed.add("sym");
        }
        String name = Emails.localPart(Emails.normalize(email));
        if (!name.isEmpty() && p.toLowerCase(Locale.ROOT).contains(name)) {
            failed.add("email");
        }
        return failed;
    }

    /** Throws {@code VALIDATION_FAILED} on {@code field} with {@code meta.rules} listing the failed rules. */
    public void check(String password, String email, String field) {
        List<String> failed = violations(password, email);
        if (!failed.isEmpty()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field,
                    "Password does not meet the rules", Map.of("rules", failed));
        }
    }
}
