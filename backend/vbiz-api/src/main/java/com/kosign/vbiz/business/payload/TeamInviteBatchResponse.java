package com.kosign.vbiz.business.payload;

import java.util.List;

/** The invites sent, and each email that was refused with why (already on the team, not an email …). */
public record TeamInviteBatchResponse(List<TeamInviteResponse> sent, List<Failed> failed) {

    public record Failed(String email, String code, String message) {
    }
}
