package com.kosign.vbiz.catalog.domain;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** The last auto-generated barcode of a shop (885000000xxx). */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "catalog_barcode_seq")
public class BarcodeSequence {

    /** First barcode a shop hands out is START + 1. */
    public static final long START = 885_000_000_100L;

    @Id
    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "last_value", nullable = false)
    private long lastValue;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
