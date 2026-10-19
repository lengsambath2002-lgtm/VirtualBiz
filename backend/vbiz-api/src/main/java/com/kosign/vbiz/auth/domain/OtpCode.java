package com.kosign.vbiz.auth.domain;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A one-time code. Only its SHA-256 hash is stored. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "otp_code")
public class OtpCode extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", length = 10, nullable = false, updatable = false)
    private OtpPurpose purpose;

    /** Lower-cased email, or a normalised phone for PHONE. */
    @Column(name = "target", length = 254, nullable = false, updatable = false)
    private String target;

    @Column(name = "code_hash", length = 64, nullable = false, updatable = false)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "resend_at", nullable = false)
    private Instant resendAt;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload")
    private PendingSignup payload;
}
