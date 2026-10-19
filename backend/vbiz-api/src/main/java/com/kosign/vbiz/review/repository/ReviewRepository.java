package com.kosign.vbiz.review.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.review.domain.Review;
import com.kosign.vbiz.review.domain.ReviewTarget;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    /** Public reviews of an item (hidden ones left out). */
    List<Review> findByTargetTypeAndTargetIdAndHiddenAtIsNullOrderByAtDescIdAsc(ReviewTarget type, UUID targetId);

    /** Public reviews of a shop (hidden ones left out). */
    List<Review> findByBusinessIdAndHiddenAtIsNullOrderByAtDescIdAsc(UUID businessId);

    List<Review> findByAuthorIdOrderByAtDesc(UUID authorId);

    boolean existsByOrderIdAndTargetId(UUID orderId, UUID targetId);

    boolean existsByAppointmentIdAndTargetId(UUID appointmentId, UUID targetId);

    @org.springframework.data.jpa.repository.Query("""
            select avg(r.stars), count(r) from Review r
            where r.targetType = :type and r.targetId = :target and r.hiddenAt is null""")
    List<Object[]> statsOfTarget(@org.springframework.data.repository.query.Param("type") ReviewTarget type,
            @org.springframework.data.repository.query.Param("target") UUID target);

    @org.springframework.data.jpa.repository.Query("select avg(r.stars), count(r) from Review r where r.businessId = :businessId and r.hiddenAt is null")
    List<Object[]> statsOfBusiness(@org.springframework.data.repository.query.Param("businessId") UUID businessId);
}
