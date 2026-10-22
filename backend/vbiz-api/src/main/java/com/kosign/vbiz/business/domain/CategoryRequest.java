package com.kosign.vbiz.business.domain;

import java.time.Instant;
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

/** A shop's suggestion for a marketplace category its kind of business is missing. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "category_request")
public class CategoryRequest extends BaseEntity {

    public enum Status {
        PENDING, APPROVED, REJECTED, WITHDRAWN
    }

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Enumerated(EnumType.STRING)
    @Column(name = "business_type", length = 10, nullable = false, updatable = false)
    private BusinessType businessType;

    @Column(name = "name", length = 40, nullable = false)
    private String name;

    @Column(name = "name_kh", length = 40)
    private String nameKh;

    @Column(name = "note", length = 300)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 10, nullable = false)
    private Status status = Status.PENDING;

    @Column(name = "requested_by", nullable = false, updatable = false)
    private UUID requestedBy;

    @Column(name = "requested_by_name", length = 80, nullable = false, updatable = false)
    private String requestedByName;

    @Column(name = "decided_by_name", length = 80)
    private String decidedByName;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "decision_note", length = 300)
    private String decisionNote;

    /** The category the shop now has (new or mapped), once approved. */
    @Column(name = "category_id", length = 40)
    private String categoryId;
}
