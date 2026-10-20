package com.kosign.vbiz.common.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Encrypts small secrets at rest (two-step sign-in keys) with AES-256-GCM. The key is
 * {@code vbiz.security.data-key} (VBIZ_DATA_KEY): 32 random bytes, Base64. Sealed values are
 * {@code v1:<base64(iv | ciphertext+tag)>}; a database dump alone does not reveal them.
 */
@Component
public class SecretBox {

    private static final String PREFIX = "v1:";
    private static final SecureRandom RANDOM = new SecureRandom();
    private final SecretKeySpec key;

    public SecretBox(@Value("${vbiz.security.data-key:}") String base64Key) {
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64Key == null ? "" : base64Key.trim());
        } catch (IllegalArgumentException e) {
            raw = new byte[0];
        }
        if (raw.length != 32) {
            throw new IllegalStateException(
                    "vbiz.security.data-key (VBIZ_DATA_KEY) must be 32 random bytes, Base64-encoded");
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    public String seal(String plain) {
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + ct.length).put(iv)
                    .put(ct).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public String open(String sealed) {
        if (sealed == null || !sealed.startsWith(PREFIX)) {
            throw new IllegalStateException("Not a sealed value");
        }
        try {
            byte[] all = Base64.getDecoder().decode(sealed.substring(PREFIX.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, 12));
            return new String(c.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Cannot open a sealed value (wrong VBIZ_DATA_KEY?)", e);
        }
    }
}
