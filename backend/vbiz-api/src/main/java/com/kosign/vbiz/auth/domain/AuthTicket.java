package com.kosign.vbiz.auth.domain;

import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** {@code resetToken} / {@code phoneToken}: 10 minutes, single use, stored hashed. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "auth_ticket")
public class AuthTicket extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", length = 10, nullable = false, updatable = false)
    private TicketKind kind;

    @Column(name = "token_hash", length = 64, nullable = false, updatable = false)
    private String tokenHash;

    @Column(name = "user_id", updatable = false)
    private UUID userId;

    /** Email for RESET, normalised phone for PHONE. */
    @Column(name = "target", length = 254, nullable = false, updatable = false)
    private String target;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;
}
