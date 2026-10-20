package com.kosign.vbiz.business.payload;

import java.util.UUID;

import com.kosign.vbiz.business.domain.MemberRole;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * {@code POST /api/businesses/{id}/invites}: who to invite and as what. {@code memberId} gives an
 * existing team member (without a login) this person's account.
 */
public record TeamInviteInput(@NotBlank String email, String name, @NotNull MemberRole role, UUID memberId) {
}
