package com.kosign.vbiz.admin.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.kosign.vbiz.admin.domain.MfaSession;

public interface MfaSessionRepository extends JpaRepository<MfaSession, UUID> {

    @Modifying
    @Query("DELETE FROM MfaSession s WHERE s.userId = :userId")
    int deleteAllForUser(UUID userId);
}
