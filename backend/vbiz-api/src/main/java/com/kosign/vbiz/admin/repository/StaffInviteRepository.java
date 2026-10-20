package com.kosign.vbiz.admin.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.admin.domain.StaffInvite;

public interface StaffInviteRepository extends JpaRepository<StaffInvite, UUID> {

    Optional<StaffInvite> findByTokenHash(String tokenHash);

    /** Not accepted or withdrawn (may be expired). */
    List<StaffInvite> findByAcceptedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc();

    Optional<StaffInvite> findByEmailAndAcceptedAtIsNullAndRevokedAtIsNull(String email);
}
