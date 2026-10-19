package com.kosign.vbiz.business.domain;

import java.util.UUID;

import com.kosign.vbiz.common.persistence.BaseEntity;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A KYC document (the ID photo from Create Business). Kept in the DB until the storage domain exists. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "business_document")
public class BusinessDocument extends BaseEntity {

    public static final String ID_PHOTO = "ID_PHOTO";

    @Column(name = "business_id", nullable = false, updatable = false)
    private UUID businessId;

    @Column(name = "kind", length = 20, nullable = false, updatable = false)
    private String kind;

    @Column(name = "content_type", length = 50, nullable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Basic(fetch = FetchType.LAZY)
    @Column(name = "data", nullable = false)
    private byte[] data;
}
