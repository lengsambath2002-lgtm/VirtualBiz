package com.kosign.vbiz.notification.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.notification.domain.Notification;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    @Query("select n from Notification n where n.userId = :userId order by n.at desc, n.id desc")
    List<Notification> latestOfUser(@Param("userId") UUID userId, Pageable page);

    @Query("select n from Notification n where n.businessId = :businessId order by n.at desc, n.id desc")
    List<Notification> latestOfBusiness(@Param("businessId") UUID businessId, Pageable page);

    Optional<Notification> findByIdAndUserId(UUID id, UUID userId);

    Optional<Notification> findByIdAndBusinessId(UUID id, UUID businessId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Notification n set n.unread = false where n.userId = :userId and n.unread = true")
    int readAllOfUser(@Param("userId") UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Notification n set n.unread = false where n.businessId = :businessId and n.unread = true")
    int readAllOfBusiness(@Param("businessId") UUID businessId);
}
