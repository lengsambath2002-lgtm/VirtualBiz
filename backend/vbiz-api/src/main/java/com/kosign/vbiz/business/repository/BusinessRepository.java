package com.kosign.vbiz.business.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.business.domain.Business;

public interface BusinessRepository extends JpaRepository<Business, UUID> {

    boolean existsBySlug(String slug);

    java.util.Optional<Business> findBySlug(String slug);

    /** Businesses the marketplace may show (online, not rejected, not suspended). */
    @org.springframework.data.jpa.repository.Query("""
            select b from Business b where b.online = true and b.suspendedAt is null
              and b.verification <> com.kosign.vbiz.business.domain.VerificationStatus.REJECTED
            order by b.name asc, b.id asc""")
    java.util.List<Business> findVisible();
}
