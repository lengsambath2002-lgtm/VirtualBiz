package com.kosign.vbiz.business.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.business.domain.BusinessDocument;

public interface BusinessDocumentRepository extends JpaRepository<BusinessDocument, UUID> {

    /** The latest document of a kind (the ID photo admins check). */
    Optional<BusinessDocument> findFirstByBusinessIdAndKindOrderByCreatedAtDesc(UUID businessId, String kind);

    boolean existsByBusinessIdAndKind(UUID businessId, String kind);

    void deleteByBusinessIdAndKind(UUID businessId, String kind);
}
