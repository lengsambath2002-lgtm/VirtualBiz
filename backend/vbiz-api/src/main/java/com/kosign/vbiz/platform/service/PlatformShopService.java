package com.kosign.vbiz.platform.service;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.business.service.MembershipService;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.tenancy.TenantContext;
import com.kosign.vbiz.platform.domain.IdentityProvider;
import com.kosign.vbiz.platform.domain.PlatformOrg;
import com.kosign.vbiz.platform.domain.UserIdentity;
import com.kosign.vbiz.platform.payload.PlatformShopLinkResponse;
import com.kosign.vbiz.platform.repository.UserIdentityRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Links a shop to a Business Platform organisation (contract §4 and §6 "Connect"). Only the shop's
 * owner, and only to an organisation where their latest platform sign-in (at most
 * {@code vbiz.platform.connect-ttl} ago) shows them as OWNER or ADMIN; the platform checks that
 * again. Linking and unlinking are recorded in the shop's activity log.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlatformShopService {

    private final PlatformProperties props;
    private final PlatformClient client;
    private final PlatformStaffSync staff;
    private final BusinessRepository businesses;
    private final MembershipService membership;
    private final UserIdentityRepository identities;
    private final ShopActivityLog activity;
    private final Clock clock;

    /** Any member of the shop may see whether it is linked. */
    @Transactional(readOnly = true)
    public PlatformShopLinkResponse status(UUID userId, UUID businessId) {
        BusinessMember me = requireMember(userId, businessId);
        Business b = businesses.findById(businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        return view(b, me);
    }

    /**
     * Errors: NOT_CONFIGURED; FORBIDDEN with {@code meta.reason} NOT_OWNER, NOT_LINKED (no platform
     * sign-in on this account), SIGN_IN_AGAIN (roles older than the connect window), NOT_ORG_ADMIN or
     * PLATFORM_FORBIDDEN (the platform refused); PLATFORM_UNAVAILABLE.
     */
    @Transactional
    public PlatformShopLinkResponse connect(UUID userId, UUID businessId, String rawOrgId) {
        requireConfigured();
        BusinessMember me = requireOwner(userId, businessId);
        UUID orgId;
        try {
            orgId = UUID.fromString(rawOrgId.trim());
        } catch (IllegalArgumentException e) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "orgId", "Not an id");
        }
        UserIdentity identity = identities.findByUserIdAndProvider(userId, IdentityProvider.PLATFORM)
                .orElseThrow(() -> forbidden("NOT_LINKED", "Sign in with the Business Platform first"));
        if (identity.getClaimsAt() == null || identity.getClaimsAt().plus(props.connectTtl()).isBefore(clock.instant())) {
            throw forbidden("SIGN_IN_AGAIN", "Sign in with the Business Platform again to connect a shop");
        }
        PlatformOrg org = identity.getOrgs().stream().filter(o -> orgId.toString().equals(o.id())).findFirst()
                .filter(PlatformOrg::manages)
                .orElseThrow(() -> forbidden("NOT_ORG_ADMIN", "You must be an owner or admin of the organisation"));
        Business b = businesses.findByIdForUpdate(businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        UUID before = b.getPlatformOrgId();
        client.putLink(b.getId(), orgId, b.getName(), identity.getSubject());
        b.setPlatformOrgId(orgId);
        b.setPlatformOrgName(org.name());
        b.setPlatformLinkedAt(clock.instant());
        b.setPlatformLinkedBy(userId);
        businesses.saveAndFlush(b);
        if (before != null && !before.equals(orgId)) {
            // Moved to another organisation: access from the old one ends now; the new one's members
            // get theirs at their next platform sign-in.
            staff.unlinked(b.getId(), userId, me.getName());
        }
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("orgId", orgId.toString());
        if (before != null && !before.equals(orgId)) {
            details.put("previousOrgId", before.toString());
        }
        activity.record(b.getId(), userId, me.getName(), ShopActivityLog.PLATFORM_CONNECTED, "SHOP", b.getId(),
                org.name() == null ? orgId.toString() : org.name(), details);
        log.info("[PLATFORM] Shop {} linked to organisation {} by user {}", b.getId(), orgId, userId);
        return view(b, me);
    }

    /** Owner only. Unlinks at the platform, then here; platform-managed staff lose access. */
    @Transactional
    public PlatformShopLinkResponse disconnect(UUID userId, UUID businessId) {
        requireConfigured();
        BusinessMember me = requireOwner(userId, businessId);
        Business b = businesses.findByIdForUpdate(businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        if (b.getPlatformOrgId() == null) {
            return view(b, me);
        }
        UUID orgId = b.getPlatformOrgId();
        String orgName = b.getPlatformOrgName();
        client.deleteLink(b.getId());
        b.setPlatformOrgId(null);
        b.setPlatformOrgName(null);
        b.setPlatformLinkedAt(null);
        b.setPlatformLinkedBy(null);
        businesses.saveAndFlush(b);
        int removed = staff.unlinked(b.getId(), userId, me.getName());
        activity.record(b.getId(), userId, me.getName(), ShopActivityLog.PLATFORM_DISCONNECTED, "SHOP", b.getId(),
                orgName == null ? orgId.toString() : orgName, Map.of("orgId", orgId.toString(), "removed", removed));
        log.info("[PLATFORM] Shop {} unlinked from organisation {} by user {}", b.getId(), orgId, userId);
        return view(b, me);
    }

    private PlatformShopLinkResponse view(Business b, BusinessMember me) {
        return new PlatformShopLinkResponse(props.configured(), b.getPlatformOrgId() != null,
                b.getPlatformOrgId() == null ? null : b.getPlatformOrgId().toString(), b.getPlatformOrgName(),
                b.getPlatformLinkedAt(), me.getRole() == MemberRole.OWNER);
    }

    private BusinessMember requireMember(UUID userId, UUID businessId) {
        TenantContext.getBusinessId().ifPresent(tenant -> {
            if (!tenant.equals(businessId)) {
                throw new BusinessException(StatusCode.FORBIDDEN_TENANT);
            }
        });
        return membership.membership(userId, businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.FORBIDDEN_TENANT));
    }

    private BusinessMember requireOwner(UUID userId, UUID businessId) {
        BusinessMember me = requireMember(userId, businessId);
        if (me.getRole() != MemberRole.OWNER) {
            throw forbidden("NOT_OWNER", "Only the shop's owner connects it to the Business Platform");
        }
        return me;
    }

    private void requireConfigured() {
        if (!props.configured()) {
            throw new BusinessException(StatusCode.NOT_CONFIGURED);
        }
    }

    private static BusinessException forbidden(String reason, String message) {
        return BusinessException.withDetail(StatusCode.FORBIDDEN, "orgId", message, Map.of("reason", reason));
    }
}
