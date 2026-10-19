package com.kosign.vbiz.storage.domain;

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

/** An uploaded image: who uploaded it, what for, and where the storage backend keeps it. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "stored_file")
public class StoredFile extends BaseEntity {

    @Column(name = "owner_id")
    private UUID ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", length = 20, nullable = false, updatable = false)
    private FilePurpose purpose;

    @Column(name = "content_type", length = 40, nullable = false, updatable = false)
    private String contentType;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private int sizeBytes;

    @Column(name = "storage_key", length = 200, nullable = false, updatable = false)
    private String storageKey;
}
