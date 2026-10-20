package com.kosign.vbiz.business.service;

/** Sends shop team invites. Replace the logging implementation with the email provider's. */
public interface TeamMailer {

    void sendInvite(String email, String name, String businessName, String invitedBy, String role, String link);
}
