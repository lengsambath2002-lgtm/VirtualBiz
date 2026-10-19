package com.kosign.vbiz.admin.domain;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
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

/** One admin action in the append-only audit log ({@code admin_audit}). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "admin_audit")
public class AdminAudit extends BaseEntity {

    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(name = "actor_name", length = 80, nullable = false, updatable = false)
    private String actorName;

    /** {@code BUSINESS_VERIFIED}, {@code USER_SUSPENDED}, … (see {@code AuditLog}). */
    @Column(name = "action", length = 40, nullable = false, updatable = false)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 20, nullable = false, updatable = false)
    private AuditTarget targetType;

    @Column(name = "target_id", length = 64, nullable = false, updatable = false)
    private String targetId;

    @Column(name = "target_label", length = 200, updatable = false)
    private String targetLabel;

    @Column(name = "reason", length = 300, updatable = false)
    private String reason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details", nullable = false, updatable = false)
    private Map<String, Object> details = new LinkedHashMap<>();

    @Column(name = "at", nullable = false, updatable = false)
    private Instant at;
}
