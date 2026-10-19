package com.kosign.vbiz.account.domain;

import java.math.BigDecimal;
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

/** A saved delivery address. One per user is the default (partial unique index). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "address")
public class Address extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "label", length = 10, nullable = false)
    private AddressLabel label;

    @Column(name = "name", length = 80, nullable = false)
    private String name;

    @Column(name = "phone", length = 10, nullable = false)
    private String phone;

    @Column(name = "line", length = 200, nullable = false)
    private String line;

    @Column(name = "district", length = 80, nullable = false)
    private String district;

    @Column(name = "note", length = 300)
    private String note;

    @Column(name = "lat", precision = 9, scale = 6)
    private BigDecimal lat;

    @Column(name = "lng", precision = 9, scale = 6)
    private BigDecimal lng;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;
}
