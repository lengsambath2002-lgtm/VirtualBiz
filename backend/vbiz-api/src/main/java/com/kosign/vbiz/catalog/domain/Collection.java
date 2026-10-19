package com.kosign.vbiz.catalog.domain;

import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A shop-defined product group (open question #11, level 2), e.g. Phones or Accessories. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "collection")
public class Collection extends BaseEntity {

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "name", length = 40, nullable = false)
    private String name;

    @Column(name = "position", nullable = false)
    private int position;
}
