package com.kosign.vbiz.business.service;

import java.time.Instant;

import com.kosign.vbiz.business.domain.MemberRole;

/**
 * What a team invite email says: the shop, who invited whom as what, the Accept and Decline links,
 * when it ends, and whether the address already has a VirtualBiz account (then accepting adds the
 * shop to it; otherwise the person creates one).
 */
public record TeamInviteMail(String email, String businessName, String logoUrl, String invitedBy, MemberRole role,
        String acceptUrl, String declineUrl, Instant expiresAt, boolean hasAccount) {
}
