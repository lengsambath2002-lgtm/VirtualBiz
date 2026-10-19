package com.kosign.vbiz.account.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.account.domain.SavedListing;
import com.kosign.vbiz.account.domain.SavedTarget;

public interface SavedListingRepository extends JpaRepository<SavedListing, UUID> {

    List<SavedListing> findByUserIdOrderByCreatedAtDescIdAsc(UUID userId);

    Optional<SavedListing> findByUserIdAndTargetTypeAndTargetId(UUID userId, SavedTarget type, UUID targetId);

    long countByUserId(UUID userId);
}
