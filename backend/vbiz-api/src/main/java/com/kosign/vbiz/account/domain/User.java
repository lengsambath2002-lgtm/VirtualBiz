package com.kosign.vbiz.account.domain;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

import com.kosign.vbiz.auth.domain.SignInMethod;
import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One account per person: a customer that may also run businesses. Email is stored
 * lower-cased, phone as {@code 0XXXXXXXX}; at least one of them is set.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "email", length = 254)
    private String email;

    @Column(name = "phone", length = 10)
    private String phone;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "cover_url", length = 500)
    private String coverUrl;

    @Column(name = "pref_deals", nullable = false)
    private boolean prefDeals = true;

    @Column(name = "pref_promos", nullable = false)
    private boolean prefPromos = false;

    /** Emails about orders, bookings and shops (every inbox notification). */
    @Column(name = "pref_emails", nullable = false)
    private boolean prefEmails = true;

    @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    /** VirtualBiz staff role; null for everyone else. */
    @Enumerated(EnumType.STRING)
    @Column(name = "platform_role", length = 20)
    private PlatformRole platformRole;

    /** Set while an admin has suspended the account: no sign-in, sessions revoked. */
    @Column(name = "suspended_at")
    private Instant suspendedAt;

    @Column(name = "suspended_reason", length = 300)
    private String suspendedReason;

    /** The console asks for a new password first (a bootstrapped super-admin). */
    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword;

    /** Two-step sign-in key, sealed by {@code SecretBox}; live once {@link #mfaEnabledAt} is set. */
    @Column(name = "mfa_secret", length = 200)
    private String mfaSecret;

    @Column(name = "mfa_enabled_at")
    private Instant mfaEnabledAt;

    /** The last TOTP step accepted, so a code can't be used twice. */
    @Column(name = "mfa_last_step")
    private Long mfaLastStep;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_sign_in_method", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "method", length = 20, nullable = false)
    @Enumerated(EnumType.STRING)
    private Set<SignInMethod> signInMethods = EnumSet.noneOf(SignInMethod.class);

    public static User create(String name, String email, String phone) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setPhone(phone);
        return u;
    }

    public boolean isSuspended() {
        return suspendedAt != null;
    }

    public void addSignInMethod(SignInMethod method) {
        signInMethods.add(method);
    }

    public boolean hasPassword() {
        return passwordHash != null;
    }

    public boolean isStaff() {
        return platformRole != null;
    }

    public boolean hasMfa() {
        return mfaEnabledAt != null;
    }
}
