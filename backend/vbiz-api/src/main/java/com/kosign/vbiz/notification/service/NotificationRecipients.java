package com.kosign.vbiz.notification.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.business.domain.BusinessMember;
import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.repository.BusinessMemberRepository;
import com.kosign.vbiz.notification.domain.Notification;

import lombok.RequiredArgsConstructor;

/**
 * Who hears about a notification outside the app (email, push): a customer's goes to them, a shop's
 * to its owner and managers (not staff). Suspended accounts never.
 */
@Component
@RequiredArgsConstructor
public class NotificationRecipients {

    private final UserRepository users;
    private final BusinessMemberRepository members;

    public List<User> of(Notification n) {
        Map<UUID, User> out = new LinkedHashMap<>();
        if (n.getUserId() != null) {
            users.findById(n.getUserId()).ifPresent(u -> out.put(u.getId(), u));
        }
        if (n.getBusinessId() != null) {
            for (BusinessMember m : members.findByBusiness(n.getBusinessId())) {
                if (m.isActive() && m.getUserId() != null && m.getRole() != MemberRole.STAFF) {
                    users.findById(m.getUserId()).ifPresent(u -> out.putIfAbsent(u.getId(), u));
                }
            }
        }
        return new ArrayList<>(out.values().stream().filter(u -> !u.isSuspended()).toList());
    }
}
