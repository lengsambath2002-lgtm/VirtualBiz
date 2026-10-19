package com.kosign.vbiz.catalog.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.catalog.domain.BarcodeSequence;

import jakarta.persistence.LockModeType;

public interface BarcodeSequenceRepository extends JpaRepository<BarcodeSequence, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from BarcodeSequence s where s.businessId = :businessId")
    Optional<BarcodeSequence> lock(@Param("businessId") UUID businessId);
}
