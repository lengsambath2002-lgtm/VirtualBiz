package com.kosign.vbiz.auth.domain;

import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One refresh token (hashed). Rotation marks this row {@code rotatedAt} and inserts its
 * successor in the same family; a rotated or revoked row is never usable again.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_session")
public class UserSession extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "family_id", nullable = false, updatable = false)
    private UUID familyId;

    @Column(name = "token_hash", length = 64, nullable = false, updatable = false)
    private String tokenHash;

    @Column(name = "rotated_from", updatable = false)
    private UUID rotatedFrom;

    @Column(name = "rotated_at")
    private Instant rotatedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "user_agent", length = 300)
    private String userAgent;

    @Column(name = "ip", length = 64)
    private String ip;

    public boolean isActive(Instant now) {
        return revokedAt == null && rotatedAt == null && expiresAt.isAfter(now);
    }
}
