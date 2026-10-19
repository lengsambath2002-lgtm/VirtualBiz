package com.kosign.vbiz.payment.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.payment.domain.PaymentIntent;

import jakarta.persistence.LockModeType;

public interface PaymentIntentRepository extends JpaRepository<PaymentIntent, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from PaymentIntent i where i.id = :id")
    Optional<PaymentIntent> lockById(@Param("id") UUID id);

    @Query("""
            select i.id from PaymentIntent i
            where i.status = com.kosign.vbiz.payment.domain.IntentStatus.PENDING and i.expiresAt <= :now""")
    List<UUID> dueToExpire(@Param("now") Instant now);

    @Query("select i.id from PaymentIntent i where i.status = com.kosign.vbiz.payment.domain.IntentStatus.PENDING")
    List<UUID> pending();

    Optional<PaymentIntent> findFirstByCheckoutIdOrderByCreatedAtDesc(UUID checkoutId);
}
