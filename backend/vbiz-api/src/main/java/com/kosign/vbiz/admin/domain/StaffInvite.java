package com.kosign.vbiz.admin.domain;

import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * An emailed invitation to join VirtualBiz staff. Only the token's SHA-256 is kept; it is open
 * until accepted, withdrawn or past {@code expiresAt}.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "staff_invite")
public class StaffInvite extends BaseEntity {

    @Column(name = "email", length = 254, nullable = false)
    private String email;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 20, nullable = false)
    private PlatformRole role;

    @Column(name = "token_hash", length = 64, nullable = false, updatable = false)
    private String tokenHash;

    @Column(name = "invited_by")
    private UUID invitedBy;

    @Column(name = "invited_by_name", length = 80, nullable = false)
    private String invitedByName;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "accepted_user_id")
    private UUID acceptedUserId;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public boolean isOpen(Instant now) {
        return acceptedAt == null && revokedAt == null && expiresAt.isAfter(now);
    }
}
