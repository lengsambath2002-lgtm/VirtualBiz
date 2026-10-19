package com.kosign.vbiz.admin.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.admin.domain.Payout;

public interface PayoutRepository extends JpaRepository<Payout, UUID> {
}
