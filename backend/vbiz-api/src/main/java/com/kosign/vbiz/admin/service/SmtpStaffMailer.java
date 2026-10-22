package com.kosign.vbiz.admin.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.mail.Email;
import com.kosign.vbiz.mail.EmailSender;

import lombok.RequiredArgsConstructor;

/** The console staff invite email (docs/ops/email.md): who invited the person, as what, and the link. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "vbiz.mail.enabled", havingValue = "true")
public class SmtpStaffMailer implements StaffMailer {

    private final EmailSender mail;

    @Override
    public void sendInvite(String email, String name, String invitedBy, String role, String link) {
        String r = "SUPER_ADMIN".equals(role) ? "Super-admin" : "Admin";
        Email e = new Email()
                .preheader(invitedBy + " invited you to the VirtualBiz console.")
                .badge("VirtualBiz console", null)
                .heading("Join the VirtualBiz console")
                .line("Hi " + name + ", " + invitedBy + " invited you (" + email + ") to help run VirtualBiz as " + r + ".")
                .line("Accept to set up your staff sign-in. The link works for 7 days and only once.")
                .buttons("Accept invite", link, null, null)
                .small("Weren't expecting this? Ignore this email; nothing happens without you.")
                .divider()
                .heading("ចូលរួមកុងសូល VirtualBiz")
                .line(invitedBy + " បានអញ្ជើញអ្នកឱ្យជួយដំណើរការ VirtualBiz។")
                .buttons("ទទួលយក", link, null, null);
        mail.send(email, invitedBy + " invited you to the VirtualBiz console", e);
    }
}
