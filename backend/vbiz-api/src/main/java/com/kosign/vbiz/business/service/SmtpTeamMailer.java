package com.kosign.vbiz.business.service;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.mail.Email;
import com.kosign.vbiz.mail.EmailSender;

import lombok.RequiredArgsConstructor;

/**
 * The team invite email (docs/ops/email.md), in English then Khmer: the shop, who invited the
 * person and as what (with what the role can do), and Accept / Decline. Both open the invite page,
 * which asks for one more click, so a mail scanner that opens links can't accept or decline.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "vbiz.mail.enabled", havingValue = "true")
public class SmtpTeamMailer implements TeamMailer {

    private static final ZoneId PP = ZoneId.of("Asia/Phnom_Penh");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH);

    private final EmailSender mail;

    @Override
    public void sendInvite(TeamInviteMail m) {
        String until = DAY.format(m.expiresAt().atZone(PP));
        String untilKh = m.expiresAt().atZone(PP).toLocalDate().toString();
        Email e = new Email()
                .preheader(m.invitedBy() + " invited you to work at " + m.businessName() + " as " + role(m.role()) + ".")
                .badge(m.businessName(), m.logoUrl())
                .heading("Join " + m.businessName() + " on VirtualBiz")
                .line(m.invitedBy() + " invited you (" + m.email() + ") to work at " + m.businessName() + " as "
                        + role(m.role()) + ".")
                .fact(role(m.role()), can(m.role()))
                .line(m.hasAccount()
                        ? "Accept with your VirtualBiz account: the shop is added to your workspaces with this role."
                        : "Accept to create your VirtualBiz login: your name and a password, then you're in.")
                .buttons("Accept invite", m.acceptUrl(), "Decline", m.declineUrl())
                .small("The invite works until " + until + ". If you weren't expecting it, decline it or ignore this email.")
                .divider()
                .heading("ចូលរួម " + m.businessName() + " នៅលើ VirtualBiz")
                .line(m.invitedBy() + " បានអញ្ជើញអ្នក (" + m.email() + ") ឱ្យធ្វើការនៅ " + m.businessName() + " ជា"
                        + roleKh(m.role()) + "។")
                .fact(roleKh(m.role()), canKh(m.role()))
                .buttons("ទទួលយក", m.acceptUrl(), "បដិសេធ", m.declineUrl())
                .small("ការអញ្ជើញមានសុពលភាពរហូតដល់ " + untilKh + "។");
        mail.send(m.email(), m.invitedBy() + " invited you to join " + m.businessName() + " on VirtualBiz", e);
    }

    private static String role(MemberRole r) {
        return r == MemberRole.MANAGER ? "Manager" : "Staff";
    }

    private static String roleKh(MemberRole r) {
        return r == MemberRole.MANAGER ? "អ្នកគ្រប់គ្រង" : "បុគ្គលិក";
    }

    private static String can(MemberRole r) {
        return r == MemberRole.MANAGER
                ? "Runs the shop: products, prices, stock, orders, promotions, settings and inviting staff. Not the payout account or roles."
                : "Day-to-day work: orders, the register, bookings and customers. Can't change settings, prices or the team.";
    }

    private static String canKh(MemberRole r) {
        return r == MemberRole.MANAGER
                ? "ដំណើរការហាង៖ ផលិតផល តម្លៃ ស្តុក ការបញ្ជាទិញ ប្រូម៉ូសិន ការកំណត់ និងការអញ្ជើញបុគ្គលិក។ មិនរួមគណនីទទួលប្រាក់ ឬតួនាទីទេ។"
                : "ការងារប្រចាំថ្ងៃ៖ ការបញ្ជាទិញ កន្លែងគិតលុយ ការកក់ និងអតិថិជន។ មិនអាចប្ដូរការកំណត់ តម្លៃ ឬក្រុមបានទេ។";
    }
}
