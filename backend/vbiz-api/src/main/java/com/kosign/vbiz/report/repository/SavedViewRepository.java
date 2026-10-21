package com.kosign.vbiz.report.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.report.domain.SavedView;

public interface SavedViewRepository extends JpaRepository<SavedView, UUID> {

    List<SavedView> findByUserIdAndListKeyOrderByNameAsc(UUID userId, String listKey);

    Optional<SavedView> findByUserIdAndListKeyAndNameIgnoreCase(UUID userId, String listKey, String name);

    long countByUserIdAndListKey(UUID userId, String listKey);
}
