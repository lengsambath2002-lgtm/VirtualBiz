package com.kosign.vbiz.business.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.business.domain.CategoryRequest;

public interface CategoryRequestRepository extends JpaRepository<CategoryRequest, UUID> {

    List<CategoryRequest> findByBusinessIdOrderByCreatedAtDesc(UUID businessId);

    Optional<CategoryRequest> findByBusinessIdAndStatus(UUID businessId, CategoryRequest.Status status);

    Page<CategoryRequest> findByStatus(CategoryRequest.Status status, Pageable page);

    long countByStatus(CategoryRequest.Status status);
}
