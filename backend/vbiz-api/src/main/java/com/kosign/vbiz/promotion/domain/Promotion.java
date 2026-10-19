package com.kosign.vbiz.promotion.domain;

import java.math.BigDecimal;
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

/** A promotion; {@code businessId} null = platform-wide, {@code code} null = automatic. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "promotion")
public class Promotion extends BaseEntity {

    @Column(name = "business_id")
    private UUID businessId;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", length = 15, nullable = false)
    private PromotionType type;

    @Column(name = "value", precision = 12, scale = 2, nullable = false)
    private BigDecimal value;

    @Column(name = "code", length = 30)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", length = 10, nullable = false)
    private PromotionScope scope;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "target_ids", nullable = false)
    private List<String> targetIds = new ArrayList<>();

    @Column(name = "min_spend", precision = 12, scale = 2)
    private BigDecimal minSpend;

    @Column(name = "max_discount", precision = 12, scale = 2)
    private BigDecimal maxDiscount;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Column(name = "uses", nullable = false)
    private int uses;

    @Column(name = "usage_limit")
    private Integer usageLimit;
}
