package com.kosign.vbiz.business.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.common.logging.LogMask;

import lombok.extern.slf4j.Slf4j;

/**
 * Where emails are off ({@code vbiz.mail.enabled=false}): logs that an invite went out (never the
 * link, which lets its holder join the shop). With {@code vbiz.team.expose-dev-links} the API
 * returns the link to the inviter instead.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "vbiz.mail.enabled", havingValue = "false", matchIfMissing = true)
public class LoggingTeamMailer implements TeamMailer {

    @Override
    public void sendInvite(TeamInviteMail m) {
        log.info("[TEAM] Invite for {} to {} as {} from {} (emails are off)", LogMask.contact(m.email()),
                m.businessName(), m.role(), m.invitedBy());
    }
}
