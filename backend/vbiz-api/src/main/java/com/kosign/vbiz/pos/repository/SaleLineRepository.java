package com.kosign.vbiz.pos.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.pos.domain.SaleLine;

public interface SaleLineRepository extends JpaRepository<SaleLine, UUID> {

    List<SaleLine> findBySaleIdInOrderByPositionAsc(Collection<UUID> saleIds);
}
