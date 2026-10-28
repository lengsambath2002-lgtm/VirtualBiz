package com.kosign.vbiz.platform.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

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

/**
 * An outside identity linked to a VirtualBiz account: {@code (provider, subject)} is the only key
 * (never the email). {@code orgs} and {@code claimsAt} are from the latest ID token.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_identity")
public class UserIdentity extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", length = 20, nullable = false, updatable = false)
    private IdentityProvider provider;

    @Column(name = "subject", length = 255, nullable = false, updatable = false)
    private String subject;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "email", length = 254)
    private String email;

    @Column(name = "name", length = 200)
    private String name;

    @Column(name = "locale", length = 10)
    private String locale;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "orgs", nullable = false)
    private List<PlatformOrg> orgs = new ArrayList<>();

    @Column(name = "claims_at")
    private Instant claimsAt;

    @Column(name = "last_sign_in_at")
    private Instant lastSignInAt;
}
