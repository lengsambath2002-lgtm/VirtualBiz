package com.kosign.vbiz.business.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.payload.InviteSuggestion;
import com.kosign.vbiz.business.repository.BusinessInviteRepository;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.common.helper.Emails;
import com.kosign.vbiz.customer.domain.Client;
import com.kosign.vbiz.customer.repository.ClientRepository;

import lombok.RequiredArgsConstructor;

/**
 * Who an email typed in the invite box means (docs/api/phase10-shop-team.md). Only what the shop
 * already knows is searched as the person types: its customers and its past team members. The
 * platform's accounts are matched on the whole address only, so the box can't be used to list
 * VirtualBiz users.
 */
@Service
@RequiredArgsConstructor
public class TeamLookupService {

    static final int MAX = 6;

    private final TeamService team;
    private final UserRepository users;
    private final BusinessMemberRepository members;
    private final BusinessInviteRepository invites;
    private final ClientRepository clients;
    private final MembershipService membership;

    @Transactional(readOnly = true)
    public List<InviteSuggestion> lookup(UUID userId, UUID businessId, String q) {
        team.requireLead(userId, businessId);
        String text = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (text.length() < 2) {
            return List.of();
        }
        Map<String, InviteSuggestion> out = new LinkedHashMap<>();

        if (Emails.isValid(text)) {
            String email = Emails.normalize(text);
            users.findByEmail(email).ifPresent(u -> out.put(email, of(businessId, email, u.getName(),
                    u.getAvatarUrl(), "ACCOUNT", u)));
        }
        String like = escape(text);
        for (Client c : clients.suggestByEmail(businessId, like + "%", "%" + like + "%", PageRequest.of(0, MAX))) {
            String email = Emails.normalize(c.getEmail());
            out.putIfAbsent(email, of(businessId, email, c.getName(), null, "CUSTOMER",
                    users.findByEmail(email).orElse(null)));
        }
        List<BusinessMember> former = members.findByBusiness(businessId).stream()
                .filter(m -> !m.isActive() && m.getUserId() != null).toList();
        for (BusinessMember m : former) {
            users.findById(m.getUserId()).ifPresent(u -> {
                String email = u.getEmail();
                if (email.startsWith(text) || m.getName().toLowerCase(Locale.ROOT).contains(text)) {
                    out.putIfAbsent(email, of(businessId, email, m.getName(), u.getAvatarUrl(), "FORMER", u));
                }
            });
        }
        return new ArrayList<>(out.values()).subList(0, Math.min(MAX, out.size()));
    }

    private InviteSuggestion of(UUID businessId, String email, String name, String avatar, String source, User u) {
        boolean onTeam = u != null && membership.membership(u.getId(), businessId).isPresent();
        boolean invited = invites.findByBusinessIdAndEmailAndAcceptedAtIsNullAndRevokedAtIsNull(businessId, email)
                .isPresent();
        return new InviteSuggestion(email, name, u != null && avatar == null ? u.getAvatarUrl() : avatar, source,
                onTeam, invited);
    }

    /** The typed text as a literal in a LIKE pattern. */
    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
