package com.kosign.vbiz.pos.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.pos.domain.SaleRefund;

public interface SaleRefundRepository extends JpaRepository<SaleRefund, UUID> {

    List<SaleRefund> findBySaleIdInOrderByAtAsc(Collection<UUID> saleIds);

    List<SaleRefund> findByShiftIdIn(Collection<UUID> shiftIds);
}
