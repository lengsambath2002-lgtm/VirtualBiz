package com.kosign.vbiz.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.kosign.vbiz.business.domain.MemberRole;
import com.kosign.vbiz.business.service.SmtpTeamMailer;
import com.kosign.vbiz.business.service.TeamInviteMail;

/** The email layout and the team invite's words (docs/ops/email.md). */
class EmailTest {

    @Test
    void everything_given_is_escaped_and_the_text_part_has_the_links() {
        Email e = new Email().heading("Hi <b>there</b>").line("A & B").buttons("Go", "https://x.test/?a=1&b=2", null, null);
        assertThat(e.html()).contains("Hi &lt;b&gt;there&lt;/b&gt;").contains("A &amp; B")
                .contains("href=\"https://x.test/?a=1&amp;b=2\"").doesNotContain("<b>there");
        assertThat(e.text()).contains("Hi <b>there</b>").contains("Go: https://x.test/?a=1&b=2");
    }

    @Test
    void the_invite_names_the_shop_role_and_both_choices_in_english_and_khmer() {
        EmailSender sender = mock(EmailSender.class);
        new SmtpTeamMailer(sender).sendInvite(new TeamInviteMail("dara@example.com", "Nita Gadget Store", null,
                "Kry Sonita", MemberRole.STAFF, "https://app.test/en/join/T", "https://app.test/en/join/T?decline=1",
                Instant.parse("2026-10-29T05:00:00Z"), true));
        ArgumentCaptor<Email> mail = ArgumentCaptor.forClass(Email.class);
        verify(sender).send(eq("dara@example.com"), eq("Kry Sonita invited you to join Nita Gadget Store on VirtualBiz"),
                mail.capture());
        String text = mail.getValue().text();
        assertThat(text).contains("Join Nita Gadget Store on VirtualBiz")
                .contains("as Staff").contains("Day-to-day work")
                .contains("Accept invite: https://app.test/en/join/T")
                .contains("Decline: https://app.test/en/join/T?decline=1")
                .contains("the shop is added to your workspaces")
                .contains("29 October 2026")
                .contains("ចូលរួម Nita Gadget Store");
    }

    @Test
    void outside_production_only_listed_addresses_or_domains_get_emails() {
        MailProperties gmailOnly = new MailProperties(true, null, null, java.util.List.of("gmail.com", "boss@corp.test"),
                null);
        assertThat(gmailOnly.allows("Someone@Gmail.com")).isTrue();
        assertThat(gmailOnly.allows("boss@corp.test")).isTrue();
        assertThat(gmailOnly.allows("nita@virtualbiz.com")).isFalse();
        assertThat(gmailOnly.allows("e2e.x@example.com")).isFalse();
        assertThat(new MailProperties(true, null, null, java.util.List.of(), null).allows("anyone@example.com")).isTrue();
    }

    @Test
    void the_demo_never_emails_its_made_up_accounts() {
        MailProperties demo = new MailProperties(true, null, null, null,
                java.util.List.of("virtualbiz.com", " sok.dara@gmail.com "));
        assertThat(demo.allows("nita@virtualbiz.com")).isFalse();
        assertThat(demo.allows("Sok.Dara@gmail.com")).isFalse();
        assertThat(demo.allows("someone.real@gmail.com")).isTrue();
    }
}
