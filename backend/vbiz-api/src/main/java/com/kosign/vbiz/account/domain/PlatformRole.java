package com.kosign.vbiz.account.domain;

/**
 * A VirtualBiz staff role (docs/api/phase7-admin.md). Ordinary accounts have none. {@code ADMIN}
 * runs the console; {@code SUPER_ADMIN} can also grant and remove admin roles and suspend admins.
 */
public enum PlatformRole {
    ADMIN,
    SUPER_ADMIN
}
