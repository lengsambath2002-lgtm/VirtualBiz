package com.kosign.vbiz.admin.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.common.logging.LogMask;

import lombok.extern.slf4j.Slf4j;

/**
 * Stand-in until an email provider is configured: logs that an invite went out (never the link
 * outside dev, since it signs a person in). With {@code vbiz.staff.expose-dev-links} the API
 * returns the link to the inviter instead.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "vbiz.mail.enabled", havingValue = "false", matchIfMissing = true)
public class LoggingStaffMailer implements StaffMailer {

    @Override
    public void sendInvite(String email, String name, String invitedBy, String role, String link) {
        log.info("[STAFF] Invite for {} ({}) as {} from {} (email provider not configured)",
                LogMask.contact(email), name, role, invitedBy);
    }
}
