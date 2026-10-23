package com.kosign.vbiz.firebase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.kosign.vbiz.notification.domain.NotificationKind;
import com.kosign.vbiz.notification.service.NotificationService;
import com.kosign.vbiz.support.IntegrationTest;

/** Firebase sign-in, moving old password accounts to Firebase, and push notifications (docs/ops/firebase.md). */
class FirebaseIntegrationTest extends IntegrationTest {

    @MockitoBean
    FirebaseGateway firebase;

    @Autowired
    NotificationService notifications;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void enabled() {
        when(firebase.enabled()).thenReturn(true);
    }

    @Test
    void google_sign_in_makes_the_account_then_finds_it_again() throws Exception {
        String email = uniqueEmail("fb-google");
        when(firebase.verify("g-token")).thenReturn(
                new FirebaseIdentity("uid-g-" + email, email, true, "Sokha Google", "https://x/p.png", "google.com"));

        Session first = session(mvc.perform(postJson("/api/auth/firebase", Map.of("idToken", "g-token")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.name").value("Sokha Google")).andReturn());
        Session again = session(mvc.perform(postJson("/api/auth/firebase", Map.of("idToken", "g-token")))
                .andExpect(status().isOk()).andReturn());
        assertThat(again.user().path("id").asText()).isEqualTo(first.user().path("id").asText());
        assertThat(jdbc.queryForObject("select firebase_uid from users where email = ?", String.class, email))
                .isEqualTo("uid-g-" + email);
    }

    @Test
    void a_password_account_must_confirm_its_email_first() throws Exception {
        String email = uniqueEmail("fb-pw");
        when(firebase.verify("unverified")).thenReturn(new FirebaseIdentity("u1", email, false, null, null, "password"));
        when(firebase.verify("verified")).thenReturn(new FirebaseIdentity("u1", email, true, null, null, "password"));

        mvc.perform(postJson("/api/auth/firebase", Map.of("idToken", "unverified")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.status.code").value("EMAIL_NOT_VERIFIED"));
        mvc.perform(postJson("/api/auth/firebase", Map.of("idToken", "verified", "name", "Chan Dara")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.name").value("Chan Dara"));
    }

    @Test
    void a_bad_token_is_refused() throws Exception {
        when(firebase.verify("bad")).thenThrow(new com.kosign.vbiz.common.error.BusinessException(
                com.kosign.vbiz.common.api.StatusCode.INVALID_TOKEN));
        mvc.perform(postJson("/api/auth/firebase", Map.of("idToken", "bad"))).andExpect(status().isUnauthorized());
    }

    @Test
    void an_old_password_account_moves_to_firebase_only_with_its_password() throws Exception {
        String email = uniqueEmail("fb-move");
        signUp("Move Me", email, "Move#Me2026");
        when(firebase.ensurePasswordUser(eq(email), eq("Move#Me2026"), anyString())).thenReturn("uid-moved");

        mvc.perform(postJson("/api/auth/firebase/migrate", Map.of("email", email, "password", "Wrong#Pass1")))
                .andExpect(status().isUnauthorized());
        verify(firebase, never()).ensurePasswordUser(anyString(), anyString(), anyString());

        mvc.perform(postJson("/api/auth/firebase/migrate", Map.of("email", email, "password", "Move#Me2026")))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select firebase_uid from users where email = ?", String.class, email))
                .isEqualTo("uid-moved");
    }

    @Test
    void notifications_are_pushed_to_registered_devices_and_gone_ones_forgotten() throws Exception {
        String email = uniqueEmail("fb-push");
        Session s = signUp("Push Me", email, "Push#Me2026");
        UUID id = UUID.fromString(s.user().path("id").asText());
        String live = "tok-live-" + id;
        String gone = "tok-gone-" + id;
        when(firebase.push(anyList(), anyString(), anyString(), anyString())).thenReturn(List.of(gone));

        for (String t : List.of(live, gone)) {
            mvc.perform(postJson("/api/me/push-tokens", Map.of("token", t)).header("Authorization", s.bearer()))
                    .andExpect(status().isOk());
        }
        // Not signed in: refused.
        mvc.perform(postJson("/api/me/push-tokens", Map.of("token", "x"))).andExpect(status().isUnauthorized());

        notifications.toUser(id, NotificationKind.ORDER_PLACED, Map.of("number", "VB-90", "shop", "Nita", "amount", "5.00"),
                "/orders/VB-90");
        verify(firebase, timeout(5000)).push(argThat(l -> l.containsAll(List.of(live, gone))),
                eq("Order VB-90 placed with Nita"), anyString(), argThat(link -> link.endsWith("/en/orders/VB-90")));
        org.awaitility.Awaitility.await().until(() -> count(gone) == 0);
        assertThat(count(live)).isEqualTo(1);

        mvc.perform(delete("/api/me/push-tokens").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", live))).header("Authorization", s.bearer()))
                .andExpect(status().isOk());
        assertThat(count(live)).isZero();
    }

    private int count(String token) {
        return jdbc.queryForObject("select count(*) from push_token where token = ?", Integer.class, token);
    }
}
