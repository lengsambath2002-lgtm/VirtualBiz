package com.kosign.vbiz.admin.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A sign-in (refresh-token family, so it survives token rotation) and its two-step check:
 * when it passed, and wrong codes since.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "mfa_session")
public class MfaSession {

    @Id
    @Column(name = "family_id", nullable = false, updatable = false)
    private UUID familyId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "failures", nullable = false)
    private int failures;
}
