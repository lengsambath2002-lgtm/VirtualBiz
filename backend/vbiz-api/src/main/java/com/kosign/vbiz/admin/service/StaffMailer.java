package com.kosign.vbiz.admin.service;

/** Sends staff invites. Replace the logging implementation with the email provider's. */
public interface StaffMailer {

    void sendInvite(String email, String name, String invitedBy, String role, String link);
}
