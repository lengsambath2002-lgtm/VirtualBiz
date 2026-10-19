package com.kosign.vbiz.pos.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.pos.domain.SaleRefundLine;

public interface SaleRefundLineRepository extends JpaRepository<SaleRefundLine, UUID> {

    List<SaleRefundLine> findByRefundIdIn(Collection<UUID> refundIds);
}
