package com.kosign.vbiz.auth.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.auth.domain.OtpCode;
import com.kosign.vbiz.auth.domain.OtpPurpose;

public interface OtpCodeRepository extends JpaRepository<OtpCode, UUID> {

    /** The most recent code for this purpose and target (consumed or not). */
    Optional<OtpCode> findFirstByPurposeAndTargetOrderByCreatedAtDesc(OtpPurpose purpose, String target);
}
