package com.kosign.vbiz.order.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.order.domain.OrderEvent;
import com.kosign.vbiz.order.domain.OrderStatus;

public interface OrderEventRepository extends JpaRepository<OrderEvent, UUID> {

    List<OrderEvent> findByOrderIdInOrderByAtAscCreatedAtAsc(Collection<UUID> orderIds);

    List<OrderEvent> findByOrderIdAndStatusOrderByAtDesc(UUID orderId, OrderStatus status);
}
