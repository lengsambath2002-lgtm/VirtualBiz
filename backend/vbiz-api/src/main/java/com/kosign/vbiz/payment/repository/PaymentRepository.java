package com.kosign.vbiz.payment.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.payment.domain.Payment;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByOrderIdIn(Collection<UUID> orderIds);

    Optional<Payment> findFirstByOrderId(UUID orderId);

    List<Payment> findByIntentId(UUID intentId);
}
