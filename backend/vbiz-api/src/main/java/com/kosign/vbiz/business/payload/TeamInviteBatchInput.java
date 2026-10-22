package com.kosign.vbiz.business.payload;

import java.util.List;

import com.kosign.vbiz.business.domain.MemberRole;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /api/businesses/{id}/invites/batch}: invite several people by email at once, all with
 * one role. Each person gives their own name when they join.
 */
public record TeamInviteBatchInput(@NotEmpty @Size(max = TeamInviteBatchInput.MAX) List<@NotBlank String> emails,
        @NotNull MemberRole role) {

    public static final int MAX = 20;
}
