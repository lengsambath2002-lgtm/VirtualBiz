package com.kosign.vbiz.order.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.order.domain.Checkout;

public interface CheckoutRepository extends JpaRepository<Checkout, UUID> {

    Optional<Checkout> findByCustomerIdAndIdempotencyKey(UUID customerId, String idempotencyKey);
}
