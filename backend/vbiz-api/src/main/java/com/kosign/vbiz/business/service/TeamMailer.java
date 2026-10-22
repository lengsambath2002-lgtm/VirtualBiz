package com.kosign.vbiz.business.service;

/** Sends shop team invites: by email ({@link SmtpTeamMailer}) or only logged ({@link LoggingTeamMailer}). */
public interface TeamMailer {
    void sendInvite(TeamInviteMail mail);
}
