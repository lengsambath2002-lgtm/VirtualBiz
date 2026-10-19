package com.kosign.vbiz.pos.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.pos.domain.SalePayment;

public interface SalePaymentRepository extends JpaRepository<SalePayment, UUID> {

    List<SalePayment> findBySaleIdInOrderByPositionAsc(Collection<UUID> saleIds);
}
