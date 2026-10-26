package com.kosign.vbiz.common.logging;

import java.util.regex.Pattern;

/**
 * What may go into a log line about a person or a secret: an address shortened to its first letter
 * and domain (or a phone to its last three digits), and text with any run of 4+ digits (a sign-in
 * code, a card or phone number) hidden. Logs are read by more people than the data was meant for.
 */
public final class LogMask {

    private static final Pattern DIGITS = Pattern.compile("\\d{4,}");

    private LogMask() {
    }

    /** {@code dara@gmail.com} → {@code d***@gmail.com}; {@code 012345678} → {@code ***678}. */
    public static String contact(String target) {
        if (target == null || target.length() < 4) {
            return "***";
        }
        int at = target.indexOf('@');
        if (at > 1) {
            return target.charAt(0) + "***" + target.substring(at);
        }
        return "***" + target.substring(target.length() - 3);
    }

    /** {@code "482913 is your VirtualBiz code"} → {@code "•••• is your VirtualBiz code"}. */
    public static String text(String s) {
        return s == null ? null : DIGITS.matcher(s).replaceAll("••••");
    }
}
