package com.kosign.vbiz.business.domain;

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

/** A person working at a business (Owner / Manager / Staff). {@code userId} is null for staff without an account. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "business_member")
public class BusinessMember extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 10, nullable = false)
    private MemberRole role;

    @Column(name = "title", length = 80)
    private String title;

    @Column(name = "color", length = 9)
    private String color;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "shifts")
    private List<List<Integer>> shifts;

    @Column(name = "active", nullable = false)
    private boolean active = true;
}
