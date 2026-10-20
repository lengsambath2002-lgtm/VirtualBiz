package com.kosign.vbiz.business.service;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Stand-in until an email provider is configured: logs that an invite went out (never the link,
 * which lets its holder join the shop). With {@code vbiz.team.expose-dev-links} the API returns
 * the link to the inviter instead.
 */
@Slf4j
@Component
public class LoggingTeamMailer implements TeamMailer {

    @Override
    public void sendInvite(String email, String name, String businessName, String invitedBy, String role,
            String link) {
        log.info("[TEAM] Invite for {} ({}) to {} as {} from {} (email provider not configured)", email, name,
                businessName, role, invitedBy);
    }
}
