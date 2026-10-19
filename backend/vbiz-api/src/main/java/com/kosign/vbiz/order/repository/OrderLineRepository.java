package com.kosign.vbiz.order.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.order.domain.OrderLine;

public interface OrderLineRepository extends JpaRepository<OrderLine, UUID> {

    List<OrderLine> findByOrderIdInOrderByPositionAsc(Collection<UUID> orderIds);
}
