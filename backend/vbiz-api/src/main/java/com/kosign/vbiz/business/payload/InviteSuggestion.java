package com.kosign.vbiz.business.payload;

/**
 * {@code GET /api/businesses/{id}/invites/lookup}: someone the typed email may mean. {@code source}:
 * {@code ACCOUNT} (the exact address has a VirtualBiz account), {@code CUSTOMER} (one of the shop's
 * customers), {@code FORMER} (a past team member). {@code onTeam} and {@code invited} say an invite
 * isn't needed.
 */
public record InviteSuggestion(String email, String name, String avatarUrl, String source, boolean onTeam,
        boolean invited) {
}
