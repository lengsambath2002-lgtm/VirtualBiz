package com.kosign.vbiz.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.kosign.vbiz.mail.Email;
import com.kosign.vbiz.mail.EmailSender;
import com.kosign.vbiz.notification.domain.NotificationKind;
import com.kosign.vbiz.notification.service.NotificationEmailContent;
import com.kosign.vbiz.notification.service.NotificationService;
import com.kosign.vbiz.support.IntegrationTest;

/** Every inbox notification also goes out by email (docs/ops/email.md). */
@TestPropertySource(properties = "vbiz.mail.enabled=true")
class NotificationEmailsTest extends IntegrationTest {

    @MockitoBean
    EmailSender mail;

    @Autowired
    NotificationService notifications;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void every_kind_that_reaches_an_inbox_has_an_email() throws Exception {
        Map<String, String> p = Map.of("number", "VB-1", "shop", "Shop", "name", "Dara", "amount", "9.50",
                "date", "2026-10-30", "time", "10:00", "service", "Haircut", "stars", "5", "reason", "rejected.outOfStock");
        for (var f : NotificationKind.class.getDeclaredFields()) {
            if (!Modifier.isStatic(f.getModifiers()) || f.getName().equals("LOW_STOCK")) {
                continue;
            }
            String kind = (String) f.get(null);
            assertThat(NotificationEmailContent.of(kind, p, false)).as(kind).isNotNull();
            assertThat(NotificationEmailContent.of(kind, p, true)).as(kind).isNotNull();
        }
        assertThat(NotificationEmailContent.of(NotificationKind.ORDER_CANCELLED, p, false).line())
                .contains("rejected: item out of stock");
    }

    @Test
    void a_customer_gets_their_own_and_a_shop_s_owner_gets_the_shop_s_unless_turned_off() throws Exception {
        String email = uniqueEmail("mailme");
        signUp("Mail Me", email, "Mail#Me2026");
        UUID id = jdbc.queryForObject("select id from users where email = ?", UUID.class, email);

        notifications.toUser(id, NotificationKind.ORDER_PLACED, Map.of("number", "VB-77", "shop", "Nita", "amount", "12.00"),
                "/orders/VB-77");
        verify(mail, timeout(5000)).send(eq(email), eq("Order VB-77 placed with Nita"), any(Email.class));

        notifications.toBusiness(UUID.fromString(NITA_GADGET_ID), NotificationKind.NEW_REVIEW,
                Map.of("name", "Mail Me", "stars", "4"), "/seller/reviews");
        verify(mail, timeout(5000)).send(eq(NITA), contains("4★ review from Mail Me"), any(Email.class));

        // Turned off in My settings: no more emails (the inbox still has them).
        jdbc.update("update users set pref_emails = false where id = ?", id);
        notifications.toUser(id, NotificationKind.ORDER_ACCEPTED, Map.of("number", "VB-78", "shop", "Nita"), "/orders/VB-78");
        verify(mail, after(1500).never()).send(eq(email), contains("VB-78"), any(Email.class));
        assertThat(Arrays.asList(email, NITA)).isNotEmpty();
    }
}
