package com.kosign.vbiz.admin.domain;

import java.time.Instant;
import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A one-time recovery code for two-step sign-in (SHA-256 of the normalised code). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "mfa_recovery_code")
public class MfaRecoveryCode extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "code_hash", length = 64, nullable = false, updatable = false)
    private String codeHash;

    @Column(name = "used_at")
    private Instant usedAt;
}
