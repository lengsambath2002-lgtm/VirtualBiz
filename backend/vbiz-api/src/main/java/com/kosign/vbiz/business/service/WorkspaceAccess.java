package com.kosign.vbiz.business.service;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.BusinessType;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.CurrentUser;
import com.kosign.vbiz.common.tenancy.TenantContext;

import lombok.RequiredArgsConstructor;

/**
 * The business a merchant request acts for ({@code X-Business-Id}, checked by the tenancy
 * filter) plus the caller's membership. Catalog and inventory services start every call here.
 */
@Service
@RequiredArgsConstructor
public class WorkspaceAccess {

    private final BusinessRepository businesses;
    private final MembershipService membership;

    /** The caller acting for a business: who they are and in which role. */
    public record Workspace(UUID userId, BusinessMember member, Business business) {

        public UUID businessId() {
            return business.getId();
        }

        /** Display name for logs ("by Kry Sonita"). */
        public String actorName() {
            return member.getName();
        }
    }

    /** Any active member. {@code BUSINESS_CONTEXT_REQUIRED} without the header. */
    @Transactional(readOnly = true)
    public Workspace member() {
        UUID userId = CurrentUser.id();
        UUID businessId = TenantContext.requireBusinessId();
        BusinessMember m = membership.membership(userId, businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.FORBIDDEN_TENANT));
        Business b = businesses.findById(businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        return new Workspace(userId, m, b);
    }

    /** Owner or manager (catalog writes); staff get {@code FORBIDDEN}. */
    @Transactional(readOnly = true)
    public Workspace manager() {
        Workspace w = member();
        if (w.member().getRole() == MemberRole.STAFF) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        return w;
    }

    /** {@code WRONG_BUSINESS_TYPE} unless the workspace's business has this type. */
    public static void requireType(Workspace w, BusinessType type) {
        if (w.business().getType() != type) {
            throw new BusinessException(StatusCode.WRONG_BUSINESS_TYPE);
        }
    }
}
