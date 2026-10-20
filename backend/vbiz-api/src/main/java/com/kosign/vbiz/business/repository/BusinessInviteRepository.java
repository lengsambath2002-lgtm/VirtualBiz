package com.kosign.vbiz.business.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.business.domain.BusinessInvite;

public interface BusinessInviteRepository extends JpaRepository<BusinessInvite, UUID> {

    Optional<BusinessInvite> findByTokenHash(String tokenHash);

    List<BusinessInvite> findByBusinessIdAndAcceptedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(UUID businessId);

    Optional<BusinessInvite> findByBusinessIdAndEmailAndAcceptedAtIsNullAndRevokedAtIsNull(UUID businessId,
            String email);
}
