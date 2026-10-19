package com.kosign.vbiz.business.service;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.common.tenancy.TenantMembershipChecker;

import lombok.RequiredArgsConstructor;

/** Business membership checks; backs the tenancy filter ({@code X-Business-Id}). */
@Service
@RequiredArgsConstructor
public class MembershipService implements TenantMembershipChecker {

    private final BusinessMemberRepository members;

    @Override
    @Transactional(readOnly = true)
    public boolean isMember(UUID userId, UUID businessId) {
        return members.existsByBusinessIdAndUserIdAndActiveTrue(businessId, userId);
    }

    /** Every member of a business (staff list for the calendar and the service form). */
    @Transactional(readOnly = true)
    public List<BusinessMember> members(UUID businessId) {
        return members.findByBusiness(businessId);
    }

    /** Active members of these businesses (marketplace staff lists). */
    @Transactional(readOnly = true)
    public List<BusinessMember> activeMembers(Collection<UUID> businessIds) {
        return businessIds.isEmpty() ? List.of() : members.findByBusinessIdInAndActiveTrue(businessIds);
    }

    @Transactional(readOnly = true)
    public Optional<BusinessMember> membership(UUID userId, UUID businessId) {
        return members.findByBusinessIdAndUserIdAndActiveTrue(businessId, userId);
    }
}
