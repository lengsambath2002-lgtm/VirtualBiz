package com.kosign.vbiz.notification.domain;

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

/**
 * One in-app inbox entry: a customer's ({@code userId}) or a shop's ({@code businessId}, shared by
 * its members). The client renders {@code kind} with {@code params}; {@code route} is where a tap goes.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "notification")
public class Notification extends BaseEntity {

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "business_id")
    private UUID businessId;

    @Column(name = "kind", length = 30, nullable = false)
    private String kind;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "params", nullable = false)
    private Map<String, String> params = new LinkedHashMap<>();

    @Column(name = "route", length = 200, nullable = false)
    private String route;

    @Column(name = "unread", nullable = false)
    private boolean unread = true;

    @Column(name = "at", nullable = false)
    private Instant at;
}
