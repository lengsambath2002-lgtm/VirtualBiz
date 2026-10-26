package com.kosign.vbiz.account.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    /**
     * The notification topics turned off, per channel: {@code {"email": ["STOCK"], "push": []}}.
     * Anything not listed is on, so a new topic starts on.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "notify_off", nullable = false)
    private Map<String, List<String>> notifyOff = new LinkedHashMap<>();

    /** The Firebase Authentication account this one signs in with (docs/ops/firebase.md). */
    @Column(name = "firebase_uid", length = 128)
    private String firebaseUid;

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

    /** Whether this person wants {@code topic} by {@code channel} (the inbox always gets it). */
    public boolean wants(NotifyTopic.Channel channel, NotifyTopic topic) {
        List<String> off = notifyOff == null ? null : notifyOff.get(key(channel));
        return off == null || !off.contains(topic.name());
    }

    public void setWants(NotifyTopic.Channel channel, NotifyTopic topic, boolean on) {
        Map<String, List<String>> next = new LinkedHashMap<>(notifyOff == null ? Map.of() : notifyOff);
        List<String> off = new ArrayList<>(next.getOrDefault(key(channel), List.of()));
        off.remove(topic.name());
        if (!on) {
            off.add(topic.name());
        }
        next.put(key(channel), off);
        notifyOff = next; // a new map, so the JSON column is seen as changed
    }

    private static String key(NotifyTopic.Channel channel) {
        return channel.name().toLowerCase(Locale.ROOT);
    }
}
