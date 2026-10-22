package com.kosign.vbiz.activity.domain;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One thing a person did in a shop ({@code shop_activity}, append-only). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "shop_activity")
public class ShopActivity extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "actor_id", updatable = false)
    private UUID actorId;

    @Column(name = "actor_name", length = 80, nullable = false, updatable = false)
    private String actorName;

    @Column(name = "action", length = 40, nullable = false, updatable = false)
    private String action;

    @Column(name = "target_type", length = 20, nullable = false, updatable = false)
    private String targetType;

    @Column(name = "target_id", length = 64, updatable = false)
    private String targetId;

    @Column(name = "target_label", length = 200, updatable = false)
    private String targetLabel;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details", nullable = false, updatable = false)
    private Map<String, Object> details = new LinkedHashMap<>();

    @Column(name = "at", nullable = false, updatable = false)
    private Instant at;
}
