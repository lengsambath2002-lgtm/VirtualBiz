package com.kosign.vbiz.business.service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.activity.service.ShopActivityLog;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.auth.domain.SignInMethod;
import com.kosign.vbiz.auth.payload.AuthResult;
import com.kosign.vbiz.auth.service.AuthService;
import com.kosign.vbiz.auth.service.ClientInfo;
import com.kosign.vbiz.auth.service.LoginAttemptService;
import com.kosign.vbiz.auth.service.PasswordPolicy;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.domain.BusinessInvite;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.payload.JoinAcceptInput;
import com.kosign.vbiz.business.payload.JoinPreviewResponse;
import com.kosign.vbiz.business.payload.JoinedResponse;
import com.kosign.vbiz.business.payload.TeamInviteInput;
import com.kosign.vbiz.business.payload.TeamInviteResponse;
import com.kosign.vbiz.business.repository.BusinessInviteRepository;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Emails;
import com.kosign.vbiz.common.security.SecureTokens;
import com.kosign.vbiz.common.tenancy.TenantContext;

import lombok.RequiredArgsConstructor;

/**
 * A shop's team invites (docs/api/phase10-shop-team.md). The owner invites managers and staff;
 * a manager invites staff. The emailed link (single use, {@code vbiz.team.invite-ttl}) lets the
 * person create an account or confirm their existing one, and join with that role, either as a
 * new member or as an existing member that had no login (a stylist already on the calendar).
 */
@Service
@RequiredArgsConstructor
public class TeamService {

    public static final String PATH = "/join/";

    private final ShopActivityLog activity;
    private final BusinessRepository businesses;
    private final BusinessMemberRepository members;
    private final BusinessInviteRepository invites;
    private final MembershipService membership;
    private final UserRepository users;
    private final TeamMailer mailer;
    private final TeamProperties props;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptService loginAttempts;
    private final AuthService auth;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<TeamInviteResponse> open(UUID userId, UUID businessId) {
        requireLead(userId, businessId);
        Instant now = clock.instant();
        return invites.findByBusinessIdAndAcceptedAtIsNullAndRevokedAtIsNullOrderByCreatedAtDesc(businessId)
                .stream().map(i -> view(i, now, null)).toList();
    }

    @Transactional
    public TeamInviteResponse invite(UUID userId, UUID businessId, TeamInviteInput in) {
        BusinessMember me = requireLead(userId, businessId);
        Business b = businesses.findById(businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.BUSINESS_NOT_FOUND));
        if (in.role() == MemberRole.OWNER) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "role", "MANAGER or STAFF");
        }
        if (in.role() == MemberRole.MANAGER && me.getRole() != MemberRole.OWNER) {
            throw BusinessException.withDetail(StatusCode.FORBIDDEN, "role", "Only the owner invites managers");
        }
        String email = Emails.normalizeOrThrow(in.email(), "email");
        users.findByEmail(email).flatMap(u -> membership.membership(u.getId(), businessId)).ifPresent(m -> {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "email", "Already on this team");
        });
        BusinessMember linked = null;
        if (in.memberId() != null) {
            linked = members.findById(in.memberId()).filter(m -> m.getBusinessId().equals(businessId))
                    .orElseThrow(() -> new BusinessException(StatusCode.MEMBER_NOT_FOUND));
            if (linked.getUserId() != null || linked.getRole() == MemberRole.OWNER) {
                throw BusinessException.withDetail(StatusCode.CONFLICT, "memberId", "This member already has a login");
            }
            if (me.getRole() == MemberRole.MANAGER && linked.getRole() != MemberRole.STAFF) {
                throw BusinessException.withDetail(StatusCode.FORBIDDEN, "memberId", "Managers invite staff only");
            }
        }
        String name = in.name() != null && in.name().trim().length() >= 2 ? in.name().trim()
                : linked != null ? linked.getName() : Emails.localPart(email);
        Instant now = clock.instant();
        invites.findByBusinessIdAndEmailAndAcceptedAtIsNullAndRevokedAtIsNull(businessId, email).ifPresent(old -> {
            old.setRevokedAt(now);
            invites.saveAndFlush(old);
        });
        String token = SecureTokens.randomToken();
        BusinessInvite i = new BusinessInvite();
        i.setBusinessId(businessId);
        i.setMemberId(linked == null ? null : linked.getId());
        i.setEmail(email);
        i.setName(name.length() > 80 ? name.substring(0, 80) : name);
        i.setRole(in.role());
        i.setTokenHash(SecureTokens.sha256Hex(token));
        i.setInvitedBy(userId);
        i.setInvitedByName(me.getName());
        i.setExpiresAt(now.plus(props.inviteTtl()));
        invites.saveAndFlush(i);
        activity.record(businessId, userId, me.getName(), ShopActivityLog.TEAM_INVITED, "MEMBER", i.getId(), email,
                Map.of("role", in.role().name()));
        String link = props.appUrl() + "/en" + PATH + token;
        String logo = b.getLogoUrl() != null && b.getLogoUrl().startsWith("/") ? props.appUrl() + b.getLogoUrl()
                : b.getLogoUrl();
        mailer.sendInvite(new TeamInviteMail(email, b.getName(), logo, me.getName(), in.role(), link,
                link + "?decline=1", i.getExpiresAt(), users.findByEmail(email).isPresent()));
        return view(i, now, props.exposeDevLinks() ? PATH + token : null);
    }

    @Transactional
    public void revoke(UUID userId, UUID businessId, UUID inviteId) {
        BusinessMember me = requireLead(userId, businessId);
        BusinessInvite i = invites.findById(inviteId).filter(x -> x.getBusinessId().equals(businessId))
                .orElseThrow(() -> new BusinessException(StatusCode.INVITE_NOT_FOUND));
        if (me.getRole() == MemberRole.MANAGER && i.getRole() != MemberRole.STAFF) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        if (i.getAcceptedAt() != null || i.getRevokedAt() != null) {
            throw new BusinessException(StatusCode.INVITE_EXPIRED);
        }
        i.setRevokedAt(clock.instant());
        invites.saveAndFlush(i);
        activity.record(businessId, userId, me.getName(), ShopActivityLog.TEAM_INVITE_WITHDRAWN, "MEMBER", i.getId(),
                i.getEmail(), Map.of("role", i.getRole().name()));
    }

    /** Public: the shop and role the link offers. */
    @Transactional(readOnly = true)
    public JoinPreviewResponse preview(String token) {
        BusinessInvite i = openInvite(token);
        Business b = businesses.findById(i.getBusinessId())
                .orElseThrow(() -> new BusinessException(StatusCode.INVITE_NOT_FOUND));
        User existing = users.findByEmail(i.getEmail()).orElse(null);
        // An existing account keeps its own name; the invite's is only a guess from the address.
        String name = existing != null ? existing.getName() : i.getName();
        return new JoinPreviewResponse(b.getId().toString(), b.getName(), b.getType(), b.getLogoUrl(), i.getEmail(), name,
                i.getRole(), i.getInvitedByName(), i.getExpiresAt(), existing != null,
                existing != null && existing.hasPassword());
    }

    /**
     * Public: joins the team and signs in. An existing account proves it is theirs with its
     * password; a new one is created (the link proves the email).
     */
    @Transactional(noRollbackFor = BusinessException.class)
    public AuthResult accept(String token, JoinAcceptInput in, ClientInfo client) {
        BusinessInvite i = openInvite(token);
        User u = users.findByEmail(i.getEmail()).orElse(null);
        if (u != null && u.hasPassword()) {
            loginAttempts.assertNotLocked(u);
            if (!passwordEncoder.matches(in.password(), u.getPasswordHash())) {
                loginAttempts.recordFailure(u.getId()); // throws INVALID_CREDENTIALS
            }
            loginAttempts.reset(u);
        } else {
            passwordPolicy.check(in.password(), i.getEmail(), "password", u != null && u.isStaff());
            if (u == null) {
                String name = in.name() == null || in.name().trim().length() < 2 ? i.getName() : in.name().trim();
                u = User.create(name.length() > 80 ? name.substring(0, 80) : name, i.getEmail(), null);
            }
            u.setPasswordHash(passwordEncoder.encode(in.password()));
            u.addSignInMethod(SignInMethod.PASSWORD);
        }
        if (u.isSuspended()) {
            throw new BusinessException(StatusCode.ACCOUNT_SUSPENDED);
        }
        u = users.saveAndFlush(u);
        join(i, u);
        return auth.signInAfterInvite(u, client);
    }

    /**
     * Accept while signed in (docs/api/phase10-shop-team.md): an existing account joins with no
     * password, if the invite was sent to its email. Returns the shop joined.
     */
    @Transactional
    public JoinedResponse acceptAsMe(UUID userId, String token) {
        BusinessInvite i = openInvite(token);
        User u = users.findById(userId).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
        if (!i.getEmail().equalsIgnoreCase(u.getEmail())) {
            throw BusinessException.withDetail(StatusCode.FORBIDDEN, "email", "This invite is for another email",
                    Map.of("reason", "WRONG_ACCOUNT"));
        }
        if (u.isSuspended()) {
            throw new BusinessException(StatusCode.ACCOUNT_SUSPENDED);
        }
        BusinessMember m = join(i, u);
        Business b = businesses.findById(i.getBusinessId())
                .orElseThrow(() -> new BusinessException(StatusCode.INVITE_NOT_FOUND));
        return new JoinedResponse(b.getId().toString(), b.getName(), b.getType(), m.getRole());
    }

    /** Decline (public, the link proves the email): the invite closes and the shop's log says so. */
    @Transactional
    public void decline(String token) {
        BusinessInvite i = openInvite(token);
        Instant now = clock.instant();
        i.setDeclinedAt(now);
        i.setRevokedAt(now);
        invites.saveAndFlush(i);
        String who = users.findByEmail(i.getEmail()).map(User::getName).orElse(i.getEmail());
        activity.record(i.getBusinessId(), null, who, ShopActivityLog.TEAM_INVITE_DECLINED, "MEMBER", i.getId(),
                i.getEmail(), Map.of("role", i.getRole().name()));
    }

    /** Makes the account a member with the invite's role and closes the invite. */
    private BusinessMember join(BusinessInvite i, User u) {
        UUID uid = u.getId();
        if (membership.membership(uid, i.getBusinessId()).isPresent()) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "email", "Already on this team");
        }
        BusinessMember m = i.getMemberId() != null ? members.findById(i.getMemberId())
                .filter(x -> x.getUserId() == null).orElse(null) : null;
        if (m == null) {
            // A former member (deactivated) comes back; otherwise a new member.
            m = members.findByBusiness(i.getBusinessId()).stream()
                    .filter(x -> uid.equals(x.getUserId())).findFirst().orElseGet(BusinessMember::new);
            if (m.getId() == null) {
                m.setBusinessId(i.getBusinessId());
                m.setName(u.getName());
            }
        }
        m.setUserId(uid);
        m.setRole(i.getRole());
        m.setActive(true);
        members.saveAndFlush(m);
        i.setAcceptedAt(clock.instant());
        i.setAcceptedUserId(uid);
        invites.saveAndFlush(i);
        activity.record(i.getBusinessId(), uid, u.getName(), ShopActivityLog.TEAM_JOINED, "MEMBER", m.getId(),
                u.getName(), Map.of("role", i.getRole().name()));
        return m;
    }

    /** The caller's membership when they may manage the team (owner, manager). */
    public BusinessMember requireLead(UUID userId, UUID businessId) {
        TenantContext.getBusinessId().ifPresent(tenant -> {
            if (!tenant.equals(businessId)) {
                throw new BusinessException(StatusCode.FORBIDDEN_TENANT);
            }
        });
        BusinessMember me = membership.membership(userId, businessId)
                .orElseThrow(() -> new BusinessException(StatusCode.FORBIDDEN_TENANT));
        if (me.getRole() == MemberRole.STAFF) {
            throw new BusinessException(StatusCode.FORBIDDEN);
        }
        return me;
    }

    private BusinessInvite openInvite(String token) {
        BusinessInvite i = invites.findByTokenHash(SecureTokens.sha256Hex(token == null ? "" : token))
                .orElseThrow(() -> new BusinessException(StatusCode.INVITE_NOT_FOUND));
        if (!i.isOpen(clock.instant())) {
            throw new BusinessException(StatusCode.INVITE_EXPIRED);
        }
        return i;
    }

    private static TeamInviteResponse view(BusinessInvite i, Instant now, String devLink) {
        return new TeamInviteResponse(i.getId().toString(), i.getEmail(), i.getName(), i.getRole(),
                i.getMemberId() == null ? null : i.getMemberId().toString(), i.getInvitedByName(), i.getCreatedAt(),
                i.getExpiresAt(), !i.getExpiresAt().isAfter(now), devLink);
    }
}
