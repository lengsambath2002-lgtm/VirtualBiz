package com.kosign.vbiz.account.domain;

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

/** A saved product / service or a followed shop of a customer. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "saved_listing")
public class SavedListing extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 10, nullable = false, updatable = false)
    private SavedTarget targetType;

    @Column(name = "target_id", nullable = false, updatable = false)
    private UUID targetId;
}
