package com.kosign.vbiz.common.helper;

import java.util.Locale;
import java.util.regex.Pattern;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/** Emails are stored trimmed and lower-cased. Same shape check as the sign-in screen. */
public final class Emails {

    public static final Pattern VALID = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    private Emails() {
    }

    /** Trimmed, lower-cased; {@code null} for null or blank. Does not validate. */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim().toLowerCase(Locale.ROOT);
    }

    public static boolean isValid(String email) {
        return email != null && email.length() <= 254 && VALID.matcher(email).matches();
    }

    /** Normalizes then validates; {@code VALIDATION_FAILED} on {@code field} when invalid. */
    public static String normalizeOrThrow(String raw, String field) {
        String email = normalize(raw);
        if (!isValid(email)) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Not a valid email address");
        }
        return email;
    }

    /** The part before {@code @} ("nita" for "nita@virtualbiz.com"). */
    public static String localPart(String email) {
        if (email == null) {
            return "";
        }
        int at = email.indexOf('@');
        return at < 0 ? email : email.substring(0, at);
    }
}
