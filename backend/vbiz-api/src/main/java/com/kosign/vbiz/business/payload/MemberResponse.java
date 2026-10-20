package com.kosign.vbiz.business.payload;

import java.util.List;

import com.kosign.vbiz.business.domain.MemberRole;

/** {@code BusinessMember} on the wire (docs/db/domain-model.md). {@code shifts}: 7 days, Monday first. */
public record MemberResponse(
        String id,
        String businessId,
        String userId,
        String name,
        MemberRole role,
        String title,
        String color,
        List<List<Integer>> shifts,
        boolean active,
        /** The login's email when the member has an account. */
        String email) {
}
