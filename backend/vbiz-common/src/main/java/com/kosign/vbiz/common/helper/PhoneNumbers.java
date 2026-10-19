package com.kosign.vbiz.common.helper;

import java.util.regex.Pattern;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

/**
 * Cambodian phone numbers. Stored as {@code 0XXXXXXXX} (9–10 digits) and validated with
 * {@code ^0[1-9]\d{7,8}$}. {@code +855} / {@code 855} prefixes become {@code 0}.
 * Spaces, dashes, dots and parentheses are ignored.
 */
public final class PhoneNumbers {

    public static final Pattern VALID = Pattern.compile("^0[1-9]\\d{7,8}$");

    private static final Pattern SEPARATORS = Pattern.compile("[\\s\\-.()]");

    private PhoneNumbers() {
    }

    /**
     * Strips separators and rewrites the country code to a leading {@code 0}. Does not
     * validate; returns {@code null} for null or blank input.
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = SEPARATORS.matcher(raw.trim()).replaceAll("");
        if (s.startsWith("+855")) {
            s = s.substring(4);
        } else if (s.startsWith("00855")) {
            s = s.substring(5);
        } else if (s.startsWith("855")) {
            s = s.substring(3);
        } else {
            return s;
        }
        // "+855 012 345 678": the trunk 0 is sometimes kept after the country code.
        return s.startsWith("0") ? s : "0" + s;
    }

    /** True when {@code phone} is already in stored form. */
    public static boolean isValid(String phone) {
        return phone != null && VALID.matcher(phone).matches();
    }

    /** Normalizes then validates; throws {@code INVALID_PHONE} when the result is not valid. */
    public static String normalizeOrThrow(String raw) {
        String normalized = normalize(raw);
        if (!isValid(normalized)) {
            throw BusinessException.withDetail(StatusCode.INVALID_PHONE, "phone", "Not a valid phone number");
        }
        return normalized;
    }
}
