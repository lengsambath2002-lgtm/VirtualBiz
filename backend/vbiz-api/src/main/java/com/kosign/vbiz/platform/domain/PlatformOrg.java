package com.kosign.vbiz.platform.domain;

import java.util.Locale;

/**
 * An organisation membership from the ID token's {@code orgs} claim: {@code role} is OWNER, ADMIN,
 * MEMBER or GUEST (active memberships only).
 */
public record PlatformOrg(String id, String slug, String name, String role) {

    public static final String OWNER = "OWNER";
    public static final String ADMIN = "ADMIN";
    public static final String MEMBER = "MEMBER";

    public PlatformOrg {
        role = role == null ? null : role.toUpperCase(Locale.ROOT);
    }

    /** May link shops to the organisation (OWNER or ADMIN). */
    public boolean manages() {
        return OWNER.equals(role) || ADMIN.equals(role);
    }
}
