package com.kosign.vbiz.platform.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.platform.domain.PlatformOrg;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Staff access follows the platform (contract §6) for shops linked to an organisation in the ID
 * token: OWNER / ADMIN → MANAGER, MEMBER → STAFF, GUEST → no access. Such rows are marked
 * platform-managed, updated on every platform sign-in and deactivated when the person is no
 * longer in that organisation (or the shop is unlinked). A shop's OWNER row and staff added by
 * hand (or by invite) are never changed.
 *
 * <p>The token's {@code orgs} alone never grants access: before giving or updating access to a shop,
 * the platform is asked whether the shop is still linked to that organisation (an admin can unlink
 * it there). Not linked → the shop is unlinked here too and its platform-managed staff lose access;
 * no answer → no new access this time (fail closed) and existing rows are kept.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PlatformStaffSync {

    static final String VIA = "PLATFORM";
    static final String VIA_NAME = "Business Platform";

    private final BusinessRepository businesses;
    private final BusinessMemberRepository members;
    private final ShopActivityLog activity;
    private final PlatformClient platform;

    /** The VirtualBiz role an organisation role gives in a linked shop; null for none. */
    static MemberRole roleFor(String orgRole) {
        if (orgRole == null) {
            return null;
        }
        return switch (orgRole) {
            case PlatformOrg.OWNER, PlatformOrg.ADMIN -> MemberRole.MANAGER;
            case PlatformOrg.MEMBER -> MemberRole.STAFF;
            default -> null;
        };
    }

    /** Brings the person's platform-managed rows in line with {@code orgs}. Joins the caller's transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void sync(User user, List<PlatformOrg> orgs) {
        UUID userId = user.getId();
        Map<UUID, String> roleByOrg = new HashMap<>();
        for (PlatformOrg o : orgs) {
            roleByOrg.put(UUID.fromString(o.id()), o.role());
        }
        Set<UUID> granted = new HashSet<>();
        Set<UUID> kept = new HashSet<>();
        List<Business> linked = roleByOrg.isEmpty() ? List.of() : businesses.findByPlatformOrgIdIn(roleByOrg.keySet());
        for (Business b : linked) {
            if (userId.equals(b.getOwnerId())) {
                continue; // the owner keeps their OWNER row
            }
            MemberRole role = roleFor(roleByOrg.get(b.getPlatformOrgId()));
            BusinessMember m = members.findByBusinessIdAndUserId(b.getId(), userId).orElse(null);
            if (m != null && !m.isPlatformManaged()) {
                continue; // added by hand or by invite: the shop decides
            }
            if (role == null) {
                continue; // GUEST: no access (an existing row is deactivated below)
            }
            PlatformClient.LinkState link = platform.checkLink(b.getId());
            if (link.status() == PlatformClient.LinkState.Status.UNKNOWN) {
                log.warn("[PLATFORM] Could not confirm shop {} is still linked; no new access for user {} this time",
                        b.getId(), userId);
                if (m != null && m.isActive()) {
                    kept.add(b.getId());
                }
                continue;
            }
            if (link.status() == PlatformClient.LinkState.Status.NOT_LINKED
                    || !b.getPlatformOrgId().equals(link.orgId())) {
                unlinkedOnPlatform(b, user);
                continue;
            }
            granted.add(b.getId());
            if (m == null) {
                m = new BusinessMember();
                m.setBusinessId(b.getId());
                m.setUserId(userId);
                m.setName(user.getName());
                m.setRole(role);
                m.setActive(true);
                m.setPlatformManaged(true);
                members.saveAndFlush(m);
                activity.record(b.getId(), userId, user.getName(), ShopActivityLog.TEAM_JOINED, "MEMBER", m.getId(),
                        user.getName(), Map.of("role", role.name(), "via", VIA));
                log.info("[PLATFORM] User {} joined shop {} as {} through the platform", userId, b.getId(), role);
            } else if (!m.isActive() || m.getRole() != role) {
                MemberRole before = m.getRole();
                boolean wasActive = m.isActive();
                m.setRole(role);
                m.setActive(true);
                members.saveAndFlush(m);
                if (!wasActive) {
                    activity.record(b.getId(), userId, user.getName(), ShopActivityLog.TEAM_RESTORED, "MEMBER",
                            m.getId(), m.getName(), Map.of("role", role.name(), "via", VIA));
                } else {
                    activity.record(b.getId(), userId, user.getName(), ShopActivityLog.TEAM_ROLE_CHANGED, "MEMBER",
                            m.getId(), m.getName(), Map.of("from", before.name(), "to", role.name(), "via", VIA));
                }
            }
        }
        for (BusinessMember m : members.findByUserIdAndPlatformManagedTrueAndActiveTrue(userId)) {
            if (!granted.contains(m.getBusinessId()) && !kept.contains(m.getBusinessId())) {
                m.setActive(false);
                members.saveAndFlush(m);
                activity.record(m.getBusinessId(), userId, user.getName(), ShopActivityLog.TEAM_REMOVED, "MEMBER",
                        m.getId(), m.getName(), Map.of("via", VIA));
                log.info("[PLATFORM] User {} lost access to shop {} (no longer in its organisation)", userId,
                        m.getBusinessId());
            }
        }
    }

    /** The platform no longer links the shop (to that organisation): unlink it here too. */
    private void unlinkedOnPlatform(Business b, User user) {
        UUID orgId = b.getPlatformOrgId();
        String orgName = b.getPlatformOrgName();
        b.setPlatformOrgId(null);
        b.setPlatformOrgName(null);
        b.setPlatformLinkedAt(null);
        b.setPlatformLinkedBy(null);
        businesses.saveAndFlush(b);
        int removed = unlinked(b.getId(), null, VIA_NAME);
        activity.record(b.getId(), null, VIA_NAME, ShopActivityLog.PLATFORM_DISCONNECTED, "SHOP", b.getId(),
                orgName == null ? orgId.toString() : orgName,
                Map.of("orgId", orgId.toString(), "removed", removed, "via", VIA, "reason", "UNLINKED_ON_PLATFORM"));
        log.info("[PLATFORM] Shop {} is no longer linked on the platform (seen at user {}'s sign-in); unlinked here",
                b.getId(), user.getId());
    }

    /** A shop was unlinked: everyone whose access came from the platform loses it. Returns how many. */
    @Transactional(propagation = Propagation.MANDATORY)
    public int unlinked(UUID businessId, UUID actorId, String actorName) {
        List<BusinessMember> rows = members.findByBusinessIdAndPlatformManagedTrueAndActiveTrue(businessId);
        for (BusinessMember m : rows) {
            m.setActive(false);
            members.saveAndFlush(m);
            activity.record(businessId, actorId, actorName, ShopActivityLog.TEAM_REMOVED, "MEMBER", m.getId(),
                    m.getName(), Map.of("via", VIA));
        }
        return rows.size();
    }
}
