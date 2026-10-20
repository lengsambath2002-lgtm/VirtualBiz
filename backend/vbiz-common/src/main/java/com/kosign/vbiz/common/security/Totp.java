package com.kosign.vbiz.common.security;

import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Locale;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Time-based one-time passwords (RFC 6238: HMAC-SHA1, 6 digits, 30-second steps), the codes of
 * Google Authenticator, Microsoft Authenticator, 1Password and the like. Secrets are Base32.
 */
public final class Totp {

    public static final int DIGITS = 6;
    public static final long STEP_SECONDS = 30;
    private static final String B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    /** A new 160-bit secret, Base32 (32 characters). */
    public static String newSecret() {
        byte[] b = new byte[20];
        RANDOM.nextBytes(b);
        return base32(b);
    }

    /** The time step of {@code epochSeconds}. */
    public static long step(long epochSeconds) {
        return Math.floorDiv(epochSeconds, STEP_SECONDS);
    }

    /** The code for one step. */
    public static String code(String secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(unbase32(secret), "HmacSHA1"));
            byte[] h = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int o = h[h.length - 1] & 0x0f;
            int bin = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
            return String.format(Locale.ROOT, "%0" + DIGITS + "d", bin % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * The step {@code code} matches within {@code window} steps either side of {@code nowStep}
     * (clock drift), or -1. Compared in constant time.
     */
    public static long match(String secret, String code, long nowStep, int window) {
        if (code == null || !code.matches("\\d{" + DIGITS + "}")) {
            return -1;
        }
        long found = -1;
        for (long s = nowStep - window; s <= nowStep + window; s++) {
            if (SecureTokens.equalsConstantTime(code(secret, s), code)) {
                found = s;
            }
        }
        return found;
    }

    /** {@code otpauth://} URI an authenticator app reads from a QR code. */
    public static String uri(String issuer, String account, String secret) {
        String i = enc(issuer);
        return "otpauth://totp/" + i + ":" + enc(account) + "?secret=" + secret + "&issuer=" + i
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    private static String enc(String s) {
        return java.net.URLEncoder.encode(s, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
    }

    static String base32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(B32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) {
            out.append(B32.charAt((buffer << (5 - bits)) & 31));
        }
        return out.toString();
    }

    static byte[] unbase32(String s) {
        String v = s.replace("=", "").replace(" ", "").toUpperCase(Locale.ROOT);
        ByteBuffer out = ByteBuffer.allocate(v.length() * 5 / 8);
        int buffer = 0;
        int bits = 0;
        for (char c : v.toCharArray()) {
            int i = B32.indexOf(c);
            if (i < 0) {
                throw new IllegalArgumentException("Not Base32");
            }
            buffer = (buffer << 5) | i;
            bits += 5;
            if (bits >= 8) {
                out.put((byte) (buffer >> (bits - 8)));
                bits -= 8;
            }
        }
        return out.array();
    }
}
