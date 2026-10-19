package com.kosign.vbiz.business.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.business.domain.BusinessMember;

public interface BusinessMemberRepository extends JpaRepository<BusinessMember, UUID> {

    Optional<BusinessMember> findByBusinessIdAndUserIdAndActiveTrue(UUID businessId, UUID userId);

    boolean existsByBusinessIdAndUserIdAndActiveTrue(UUID businessId, UUID userId);

    /** The user's active memberships with their business, oldest first: [member, business]. */
    @Query("""
            select m, b from BusinessMember m join Business b on b.id = m.businessId
            where m.userId = :userId and m.active = true
            order by b.createdAt asc, b.id asc""")
    List<Object[]> findMembershipsOfUser(@Param("userId") UUID userId);

    /** Members of a business, owner first, then by when they joined. */
    @Query("""
            select m from BusinessMember m where m.businessId = :businessId
            order by case when m.role = com.kosign.vbiz.business.domain.MemberRole.OWNER then 0
                          when m.role = com.kosign.vbiz.business.domain.MemberRole.MANAGER then 1 else 2 end,
                     m.createdAt asc, m.id asc""")
    List<BusinessMember> findByBusiness(@Param("businessId") UUID businessId);

    List<BusinessMember> findByBusinessIdInAndActiveTrue(java.util.Collection<UUID> businessIds);
}
