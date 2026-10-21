package com.kosign.vbiz.order.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.order.domain.Order;
import com.kosign.vbiz.order.domain.OrderStatus;

import jakarta.persistence.LockModeType;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    @Query(value = "select nextval('order_number_seq')", nativeQuery = true)
    long nextNumber();

    Optional<Order> findByNumber(String number);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.id = :id")
    Optional<Order> lockById(@Param("id") UUID id);

    List<Order> findByCheckoutIdOrderByNumberAsc(UUID checkoutId);

    @Query("select o from Order o where o.customerId = :customerId order by o.createdAt desc, o.number desc")
    List<Order> ofCustomer(@Param("customerId") UUID customerId, Pageable page);

    /** Orders placed in [from, to), newest first (exports). */
    @Query("""
            select o from Order o where o.businessId = :businessId and o.placedAt >= :from and o.placedAt < :to
            order by o.placedAt desc, o.number desc""")
    List<Order> placedBetween(@Param("businessId") UUID businessId, @Param("from") Instant from,
            @Param("to") Instant to);

    /** The shop's placed orders, newest first. */
    @Query("""
            select o from Order o where o.businessId = :businessId and o.placedAt is not null
            order by o.placedAt desc, o.number desc""")
    List<Order> ofBusiness(@Param("businessId") UUID businessId, Pageable page);

    @Query("""
            select o from Order o where o.businessId = :businessId and o.placedAt is not null
              and o.status in :statuses
            order by o.placedAt desc, o.number desc""")
    List<Order> ofBusiness(@Param("businessId") UUID businessId, @Param("statuses") Collection<OrderStatus> statuses,
            Pageable page);

    @Query("""
            select o.status, count(o) from Order o where o.businessId = :businessId and o.placedAt is not null
              and o.status in (com.kosign.vbiz.order.domain.OrderStatus.NEW,
                  com.kosign.vbiz.order.domain.OrderStatus.ACCEPTED,
                  com.kosign.vbiz.order.domain.OrderStatus.PACKED,
                  com.kosign.vbiz.order.domain.OrderStatus.SHIPPED)
            group by o.status""")
    List<Object[]> openCounts(@Param("businessId") UUID businessId);

    @Query("""
            select o from Order o where o.businessId = :businessId and o.placedAt >= :from
              and o.status <> com.kosign.vbiz.order.domain.OrderStatus.CANCELLED""")
    List<Order> placedSince(@Param("businessId") UUID businessId, @Param("from") Instant from);

    /** Placed orders still NEW at or before the cutoff (auto-cancel). */
    @Query("""
            select o.id from Order o where o.status = com.kosign.vbiz.order.domain.OrderStatus.NEW
              and o.placedAt is not null and o.placedAt <= :cutoff order by o.placedAt asc""")
    List<UUID> dueForAutoCancel(@Param("cutoff") Instant cutoff);

    @Query("select o.number from Order o where o.id in :ids order by o.number asc")
    List<String> numbersOf(@Param("ids") Collection<UUID> ids);
}
