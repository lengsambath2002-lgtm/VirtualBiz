package com.kosign.vbiz.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.util.MultiValueMap;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.Totp;
import com.kosign.vbiz.platform.service.PlatformClient;
import com.kosign.vbiz.support.IntegrationTest;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import jakarta.servlet.http.Cookie;

/**
 * Single sign-on with the Business Platform (docs/adr/0003-sso-with-the-business-platform.md):
 * the platform is a mocked {@link PlatformClient} and ID tokens are signed with a local RSA key.
 * Its own Spring context (the mock), so a small pool keeps the shared Postgres under its connection limit.
 */
@TestPropertySource(properties = "spring.datasource.hikari.maximum-pool-size=3")
class PlatformSsoIntegrationTest extends IntegrationTest {

    private static final String ISS = "https://platform.test";
    private static final String CLIENT_ID = "virtualbiz-test";
    private static final String REDIRECT = "http://localhost:3000/platform/callback";
    private static final String PASSWORD = "Bright#2026";

    private static RSAKey key;
    private static RSAKey otherKey;

    @MockitoBean
    PlatformClient platform;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeAll
    static void keys() throws Exception {
        key = new RSAKeyGenerator(2048).keyID("k1").generate();
        otherKey = new RSAKeyGenerator(2048).keyID("k1").generate();
    }

    @BeforeEach
    void platformUp() {
        when(platform.discovery()).thenReturn(new PlatformClient.Discovery(ISS, ISS + "/oauth/authorize",
                ISS + "/api/oidc/token", ISS + "/api/oidc/jwks"));
        when(platform.jwks()).thenReturn(new JWKSet(key.toPublicJWK()));
        // The platform agrees with VirtualBiz about every shop's link unless a test says otherwise.
        when(platform.checkLink(any())).thenAnswer(inv -> {
            List<String> org = jdbc.queryForList("select platform_org_id::text from business where id = ?",
                    String.class, inv.getArgument(0, UUID.class));
            return org.isEmpty() || org.get(0) == null ? PlatformClient.LinkState.NOT_LINKED
                    : PlatformClient.LinkState.linked(UUID.fromString(org.get(0)));
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────────

    /** A started sign-in: the authorize URL's parameters and the browser binding cookie. */
    private record Started(MultiValueMap<String, String> query, Cookie binding) {
        String state() {
            return query.getFirst("state");
        }

        String nonce() {
            return query.getFirst("nonce");
        }
    }

    private Started start(Map<String, Object> body) throws Exception {
        MvcResult r = mvc.perform(postJson("/api/auth/platform/start", body)).andReturn();
        assertThat(r.getResponse().getStatus()).as(r.getResponse().getContentAsString()).isEqualTo(200);
        String url = body(r).path("data").path("authorizeUrl").asText();
        assertThat(url).startsWith(ISS + "/oauth/authorize?");
        return new Started(UriComponentsBuilder.fromUriString(url).build().getQueryParams(),
                r.getResponse().getCookie("vb_platform"));
    }

    private Started start() throws Exception {
        return start(Map.of("intent", "signin"));
    }

    private static Map<String, Object> claims(String sub, String email, String nonce, List<Map<String, Object>> orgs) {
        Map<String, Object> c = new HashMap<>();
        c.put("iss", ISS);
        c.put("aud", CLIENT_ID);
        c.put("sub", sub);
        c.put("nonce", nonce);
        c.put("email", email);
        c.put("email_verified", false);
        c.put("name", "Platform Person");
        c.put("locale", "km");
        c.put("orgs", orgs);
        return c;
    }

    private static String sign(Map<String, Object> claims, RSAKey with) throws Exception {
        Instant now = Instant.now();
        JWTClaimsSet.Builder b = new JWTClaimsSet.Builder()
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(300)))
                .claim("auth_time", now.getEpochSecond());
        claims.forEach((k, v) -> {
            if (v != null) {
                b.claim(k, v);
            }
        });
        if (claims.containsKey("exp")) {
            b.expirationTime(Date.from(Instant.ofEpochSecond((Long) claims.get("exp"))));
        }
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(with.getKeyID())
                .type(JOSEObjectType.JWT).build(), b.build());
        jwt.sign(new RSASSASigner(with));
        return jwt.serialize();
    }

    private static Map<String, Object> org(String id, String role) {
        return Map.of("id", id, "slug", "org-" + id.substring(0, 4), "name", "Org " + id.substring(0, 4), "role", role);
    }

    /** The platform hands back {@code idToken} for a fresh code; returns the raw response. */
    private MvcResult complete(Started s, String idToken) throws Exception {
        String code = "code-" + UUID.randomUUID();
        when(platform.exchange(eq(code), anyString(), eq(REDIRECT))).thenReturn(idToken);
        var req = postJson("/api/auth/platform/complete", Map.of("code", code, "state", s.state()));
        if (s.binding() != null) {
            req.cookie(s.binding());
        }
        return mvc.perform(req).andReturn();
    }

    /** A whole sign-in for {@code sub} with these organisations; returns the response body. */
    private JsonNode ssoSignIn(String sub, String email, List<Map<String, Object>> orgs) throws Exception {
        Started s = start();
        return body(complete(s, sign(claims(sub, email, s.nonce(), orgs), key)));
    }

    private static String code(JsonNode r) {
        return r.path("status").path("code").asText();
    }

    private static JsonNode meta(JsonNode r) {
        return r.path("error").path("details").get(0).path("meta");
    }

    private String newShop(Session owner) throws Exception {
        return body(mvc.perform(postJson("/api/businesses", Map.of("type", "PRODUCT", "name", "Linked Shop",
                "categoryId", "electronics", "district", "BKK1", "street", "#1, St. 1", "phone", uniquePhone(),
                "hours", Map.of("open", "08:00", "close", "20:00", "sunday", true)))
                .header("Authorization", owner.bearer())).andReturn()).path("data").path("id").asText();
    }

    private Map<String, Object> member(String businessId, String userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select role, active, platform_managed from business_member where business_id = ?::uuid and user_id = ?::uuid",
                businessId, userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String userId(String email) {
        return jdbc.queryForObject("select id::text from users where email = ?", String.class, email);
    }

    private void linkShop(String businessId, String orgId) {
        jdbc.update("update business set platform_org_id = ?::uuid, platform_org_name = 'Org' where id = ?::uuid", orgId,
                businessId);
    }

    // ── Sign-in ───────────────────────────────────────────────────────────────────────

    @Test
    void the_server_says_platform_sign_in_is_available() throws Exception {
        assertThat(body(mvc.perform(get("/api/auth/methods")).andReturn()).path("data").path("platform").asBoolean())
                .isTrue();
    }

    @Test
    void start_builds_the_authorize_url_with_pkce_and_complete_sends_the_verifier() throws Exception {
        Started s = start(Map.of("intent", "signin", "next", "/orders"));
        assertThat(s.query().getFirst("response_type")).isEqualTo("code");
        assertThat(s.query().getFirst("client_id")).isEqualTo(CLIENT_ID);
        assertThat(s.query().getFirst("redirect_uri")).isIn(REDIRECT, "http://localhost:3000/platform/callback");
        assertThat(s.query().getFirst("scope")).isIn("openid%20email%20profile%20orgs", "openid email profile orgs");
        assertThat(s.query().getFirst("code_challenge_method")).isEqualTo("S256");
        assertThat(s.binding()).isNotNull();
        assertThat(s.binding().isHttpOnly()).isTrue();
        // Only the hash of the state is stored.
        assertThat(jdbc.queryForObject("select count(*) from auth_ticket where kind = 'SSO_STATE' and token_hash = ?",
                Integer.class, sha256Hex(s.state()))).isEqualTo(1);

        String email = uniqueEmail("pf-new");
        AtomicReference<String> sentVerifier = new AtomicReference<>();
        when(platform.exchange(eq("the-code"), anyString(), eq(REDIRECT))).thenAnswer(inv -> {
            sentVerifier.set(inv.getArgument(1));
            return sign(claims(UUID.randomUUID().toString(), email, s.nonce(), List.of()), key);
        });
        JsonNode r = body(mvc.perform(postJson("/api/auth/platform/complete", Map.of("code", "the-code", "state",
                s.state())).cookie(s.binding())).andReturn());
        assertThat(code(r)).isEqualTo("SUCCESS");
        assertThat(r.path("data").path("next").asText()).isEqualTo("/orders");
        String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(sentVerifier.get().getBytes(StandardCharsets.US_ASCII)));
        assertThat(challenge).isEqualTo(s.query().getFirst("code_challenge"));
    }

    @Test
    void a_new_person_gets_an_account_and_the_same_sub_finds_it_again() throws Exception {
        String sub = UUID.randomUUID().toString();
        String email = uniqueEmail("pf-first");
        Started s = start();
        MvcResult first = complete(s, sign(claims(sub, email, s.nonce(), List.of()), key));
        JsonNode r = body(first);
        assertThat(code(r)).isEqualTo("SUCCESS");
        assertThat(r.path("data").path("accessToken").asText()).isNotBlank();
        assertThat(r.path("data").path("intent").asText()).isEqualTo("signin");
        assertThat(r.path("data").path("user").path("email").asText()).isEqualTo(email);
        assertThat(r.path("data").path("user").path("name").asText()).isEqualTo("Platform Person");
        assertThat(first.getResponse().getCookie("vb_refresh")).isNotNull();
        String id = r.path("data").path("user").path("id").asText();
        assertThat(jdbc.queryForObject("select user_id::text from user_identity where provider = 'PLATFORM' and subject = ?",
                String.class, sub)).isEqualTo(id);
        assertThat(jdbc.queryForObject("select count(*) from user_sign_in_method where user_id = ?::uuid and method = 'PLATFORM'",
                Integer.class, id)).isEqualTo(1);

        // Same sub, another email at the platform: still the same account (sub is the key).
        JsonNode again = ssoSignIn(sub, uniqueEmail("pf-changed"), List.of());
        assertThat(again.path("data").path("user").path("id").asText()).isEqualTo(id);
    }

    @Test
    void a_same_email_account_must_sign_in_and_confirm_before_it_is_linked() throws Exception {
        String email = uniqueEmail("pf-same");
        Session own = signUp("Own Account", email, PASSWORD);
        String sub = UUID.randomUUID().toString();
        Started s = start();
        JsonNode r = body(complete(s, sign(claims(sub, email, s.nonce(), List.of()), key)));
        assertThat(code(r)).isEqualTo("LINK_REQUIRED");
        String ticket = meta(r).path("ticket").asText();
        assertThat(ticket).isNotBlank();
        assertThat(meta(r).path("email").asText()).isEqualTo(email.charAt(0) + "***@example.com");
        // Nothing linked yet, no session handed out.
        assertThat(jdbc.queryForObject("select count(*) from user_identity where subject = ?", Integer.class, sub))
                .isZero();

        // Not signed in: refused. Another account: refused. Another browser: refused.
        mvc.perform(postJson("/api/auth/platform/link", Map.of("ticket", ticket)).cookie(s.binding()))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
        Session other = signUp("Someone Else", uniqueEmail("pf-other"), PASSWORD);
        JsonNode wrong = body(mvc.perform(postJson("/api/auth/platform/link", Map.of("ticket", ticket))
                .header("Authorization", other.bearer()).cookie(s.binding())).andReturn());
        assertThat(code(wrong)).isEqualTo("FORBIDDEN");
        assertThat(meta(wrong).path("reason").asText()).isEqualTo("WRONG_ACCOUNT");
        JsonNode noCookie = body(mvc.perform(postJson("/api/auth/platform/link", Map.of("ticket", ticket))
                .header("Authorization", own.bearer())).andReturn());
        assertThat(code(noCookie)).isEqualTo("INVALID_TOKEN");

        JsonNode linked = body(mvc.perform(postJson("/api/auth/platform/link", Map.of("ticket", ticket))
                .header("Authorization", own.bearer()).cookie(s.binding())).andReturn());
        assertThat(code(linked)).isEqualTo("SUCCESS");
        assertThat(linked.path("data").path("intent").asText()).isEqualTo("signin");
        // Single use.
        assertThat(code(body(mvc.perform(postJson("/api/auth/platform/link", Map.of("ticket", ticket))
                .header("Authorization", own.bearer()).cookie(s.binding())).andReturn()))).isEqualTo("INVALID_TOKEN");

        // From now on the platform signs straight in to that account.
        JsonNode next = ssoSignIn(sub, email, List.of());
        assertThat(code(next)).isEqualTo("SUCCESS");
        assertThat(next.path("data").path("user").path("id").asText()).isEqualTo(own.user().path("id").asText());
    }

    @Test
    void tokens_that_fail_a_check_are_refused() throws Exception {
        String email = uniqueEmail("pf-bad");
        String sub = UUID.randomUUID().toString();

        Started s1 = start();
        assertThat(code(body(complete(s1, sign(claims(sub, email, "another-nonce", List.of()), key)))))
                .isEqualTo("INVALID_TOKEN");

        Started s2 = start();
        Map<String, Object> badIss = claims(sub, email, s2.nonce(), List.of());
        badIss.put("iss", "https://evil.test");
        assertThat(code(body(complete(s2, sign(badIss, key))))).isEqualTo("INVALID_TOKEN");

        Started s3 = start();
        Map<String, Object> badAud = claims(sub, email, s3.nonce(), List.of());
        badAud.put("aud", "someone-else");
        assertThat(code(body(complete(s3, sign(badAud, key))))).isEqualTo("INVALID_TOKEN");

        Started s4 = start();
        Map<String, Object> expired = claims(sub, email, s4.nonce(), List.of());
        expired.put("exp", Instant.now().minusSeconds(120).getEpochSecond());
        assertThat(code(body(complete(s4, sign(expired, key))))).isEqualTo("INVALID_TOKEN");

        Started s5 = start();
        assertThat(code(body(complete(s5, sign(claims(sub, email, s5.nonce(), List.of()), otherKey)))))
                .isEqualTo("INVALID_TOKEN");

        assertThat(jdbc.queryForObject("select count(*) from users where email = ?", Integer.class, email)).isZero();
    }

    @Test
    void a_token_within_the_clock_skew_is_accepted() throws Exception {
        Started s = start();
        Map<String, Object> c = claims(UUID.randomUUID().toString(), uniqueEmail("pf-skew"), s.nonce(), List.of());
        c.put("exp", Instant.now().minusSeconds(30).getEpochSecond());
        assertThat(code(body(complete(s, sign(c, key))))).isEqualTo("SUCCESS");
    }

    @Test
    void an_unknown_key_id_fetches_the_keys_again() throws Exception {
        RSAKey rotated = new RSAKeyGenerator(2048).keyID("k2").generate();
        when(platform.jwks()).thenReturn(new JWKSet(List.of(key.toPublicJWK(), rotated.toPublicJWK())));
        Started s = start();
        assertThat(code(body(complete(s, sign(claims(UUID.randomUUID().toString(), uniqueEmail("pf-rot"), s.nonce(),
                List.of()), rotated))))).isEqualTo("SUCCESS");
    }

    @Test
    void a_state_works_once_and_only_in_the_browser_that_started_it() throws Exception {
        String email = uniqueEmail("pf-state");
        String sub = UUID.randomUUID().toString();
        Started s = start();
        String token = sign(claims(sub, email, s.nonce(), List.of()), key);
        assertThat(code(body(complete(new Started(s.query(), null), token)))).isEqualTo("INVALID_TOKEN");
        // The state was used up by that try.
        assertThat(code(body(complete(s, token)))).isEqualTo("INVALID_TOKEN");

        Started fresh = start();
        String ok = sign(claims(sub, email, fresh.nonce(), List.of()), key);
        assertThat(code(body(complete(fresh, ok)))).isEqualTo("SUCCESS");
        assertThat(code(body(complete(fresh, ok)))).isEqualTo("INVALID_TOKEN");
        assertThat(code(body(complete(new Started(fresh.query(), new Cookie("vb_platform", "forged")), ok))))
                .isEqualTo("INVALID_TOKEN");
    }

    @Test
    void a_refused_code_is_invalid_token() throws Exception {
        Started s = start();
        when(platform.exchange(eq("used"), anyString(), anyString())).thenThrow(
                BusinessException.withDetail(StatusCode.INVALID_TOKEN, "code", "refused"));
        assertThat(code(body(mvc.perform(postJson("/api/auth/platform/complete", Map.of("code", "used", "state",
                s.state())).cookie(s.binding())).andReturn()))).isEqualTo("INVALID_TOKEN");
    }

    @Test
    void two_step_accounts_are_asked_for_their_code() throws Exception {
        String email = uniqueEmail("pf-two");
        Session s = signUp("Two Step", email, PASSWORD);
        String secret = body(mvc.perform(post("/api/me/two-step/setup").header("Authorization", s.bearer())).andReturn())
                .path("data").path("secret").asText();
        long step = Totp.step(Instant.now().getEpochSecond());
        mvc.perform(postJson("/api/me/two-step/enable", Map.of("code", Totp.code(secret, step)))
                .header("Authorization", s.bearer()));
        String sub = UUID.randomUUID().toString();
        jdbc.update("insert into user_identity (id, provider, subject, user_id) values (?::uuid, 'PLATFORM', ?, ?::uuid)",
                UUID.randomUUID().toString(), sub, s.user().path("id").asText());

        Started st = start(Map.of("intent", "signin", "next", "/bookings"));
        JsonNode r = body(complete(st, sign(claims(sub, email, st.nonce(), List.of()), key)));
        assertThat(code(r)).isEqualTo("TWO_STEP_REQUIRED");
        String ticket = meta(r).path("ticket").asText();
        assertThat(meta(r).path("route").path("next").asText()).isEqualTo("/bookings");
        JsonNode in = body(mvc.perform(postJson("/api/auth/two-step", Map.of("ticket", ticket, "code",
                Totp.code(secret, step + 1)))).andReturn());
        assertThat(code(in)).isEqualTo("SUCCESS");
        assertThat(in.path("data").path("user").path("email").asText()).isEqualTo(email);
    }

    @Test
    void a_suspended_account_is_refused() throws Exception {
        String email = uniqueEmail("pf-susp");
        String sub = UUID.randomUUID().toString();
        assertThat(code(ssoSignIn(sub, email, List.of()))).isEqualTo("SUCCESS");
        jdbc.update("update users set suspended_at = now() where email = ?", email);
        assertThat(code(ssoSignIn(sub, email, List.of()))).isEqualTo("ACCOUNT_SUSPENDED");
    }

    // ── Staff ─────────────────────────────────────────────────────────────────────────

    @Test
    void staff_access_follows_the_organisation_role() throws Exception {
        String ownerEmail = uniqueEmail("pf-owner");
        Session owner = signUp("Shop Owner", ownerEmail, PASSWORD);
        String shop = newShop(owner);
        String orgId = UUID.randomUUID().toString();
        linkShop(shop, orgId);

        String email = uniqueEmail("pf-staff");
        String sub = UUID.randomUUID().toString();
        JsonNode r = ssoSignIn(sub, email, List.of(org(orgId, "MEMBER")));
        assertThat(code(r)).isEqualTo("SUCCESS");
        String uid = r.path("data").path("user").path("id").asText();
        assertThat(member(shop, uid)).containsEntry("role", "STAFF").containsEntry("active", true)
                .containsEntry("platform_managed", true);

        ssoSignIn(sub, email, List.of(org(orgId, "ADMIN")));
        assertThat(member(shop, uid)).containsEntry("role", "MANAGER").containsEntry("active", true);

        // Gone from the organisation: access ends.
        ssoSignIn(sub, email, List.of());
        assertThat(member(shop, uid)).containsEntry("active", false);

        // Back as a guest: still nothing.
        ssoSignIn(sub, email, List.of(org(orgId, "GUEST")));
        assertThat(member(shop, uid)).containsEntry("active", false);

        ssoSignIn(sub, email, List.of(org(orgId, "OWNER")));
        assertThat(member(shop, uid)).containsEntry("role", "MANAGER").containsEntry("active", true);

        // The shop's own log says what happened, and that it came from the platform.
        assertThat(jdbc.queryForObject("select count(*) from shop_activity where business_id = ?::uuid "
                + "and action in ('TEAM_JOINED','TEAM_ROLE_CHANGED','TEAM_REMOVED','TEAM_RESTORED') "
                + "and details->>'via' = 'PLATFORM'", Integer.class, shop)).isEqualTo(4);
    }

    @Test
    void a_shop_unlinked_on_the_platform_loses_its_platform_staff() throws Exception {
        Session owner = signUp("Shop Owner", uniqueEmail("pf-unl"), PASSWORD);
        String shop = newShop(owner);
        String orgId = UUID.randomUUID().toString();
        linkShop(shop, orgId);
        String sub = UUID.randomUUID().toString();
        String email = uniqueEmail("pf-unl-staff");
        String uid = ssoSignIn(sub, email, List.of(org(orgId, "MEMBER"))).path("data").path("user").path("id")
                .asText();
        assertThat(member(shop, uid)).containsEntry("active", true);
        // Another platform-managed member, who is not signing in now.
        String other = ssoSignIn(UUID.randomUUID().toString(), uniqueEmail("pf-unl-2"),
                List.of(org(orgId, "ADMIN"))).path("data").path("user").path("id").asText();
        assertThat(member(shop, other)).containsEntry("active", true);

        // An admin unlinked the shop on the platform: the token still lists the organisation.
        when(platform.checkLink(UUID.fromString(shop))).thenReturn(PlatformClient.LinkState.NOT_LINKED);
        assertThat(code(ssoSignIn(sub, email, List.of(org(orgId, "MEMBER"))))).isEqualTo("SUCCESS");
        assertThat(member(shop, uid)).containsEntry("active", false);
        assertThat(member(shop, other)).containsEntry("active", false);
        assertThat(jdbc.queryForObject("select platform_org_id from business where id = ?::uuid", String.class, shop))
                .isNull();
        assertThat(jdbc.queryForObject("select count(*) from shop_activity where business_id = ?::uuid and action = "
                + "'PLATFORM_DISCONNECTED' and details->>'reason' = 'UNLINKED_ON_PLATFORM'", Integer.class, shop))
                .isEqualTo(1);
        // The owner keeps the shop.
        assertThat(member(shop, owner.user().path("id").asText())).containsEntry("role", "OWNER")
                .containsEntry("active", true);
    }

    @Test
    void a_shop_moved_to_another_organisation_on_the_platform_is_unlinked_here() throws Exception {
        Session owner = signUp("Shop Owner", uniqueEmail("pf-moved"), PASSWORD);
        String shop = newShop(owner);
        String orgId = UUID.randomUUID().toString();
        linkShop(shop, orgId);
        when(platform.checkLink(UUID.fromString(shop))).thenReturn(
                PlatformClient.LinkState.linked(UUID.randomUUID()));
        String uid = ssoSignIn(UUID.randomUUID().toString(), uniqueEmail("pf-moved-st"),
                List.of(org(orgId, "MEMBER"))).path("data").path("user").path("id").asText();
        assertThat(member(shop, uid)).isNull();
        assertThat(jdbc.queryForObject("select platform_org_id from business where id = ?::uuid", String.class, shop))
                .isNull();
    }

    @Test
    void no_answer_from_the_platform_grants_nothing_new_but_keeps_existing_access() throws Exception {
        Session owner = signUp("Shop Owner", uniqueEmail("pf-down"), PASSWORD);
        String shop = newShop(owner);
        String orgId = UUID.randomUUID().toString();
        linkShop(shop, orgId);
        String sub = UUID.randomUUID().toString();
        String email = uniqueEmail("pf-down-st");
        String uid = ssoSignIn(sub, email, List.of(org(orgId, "MEMBER"))).path("data").path("user").path("id")
                .asText();
        assertThat(member(shop, uid)).containsEntry("role", "STAFF").containsEntry("active", true);

        when(platform.checkLink(UUID.fromString(shop))).thenReturn(PlatformClient.LinkState.UNKNOWN);
        // Existing access stays as it was (not promoted either), sign-in still works.
        assertThat(code(ssoSignIn(sub, email, List.of(org(orgId, "ADMIN"))))).isEqualTo("SUCCESS");
        assertThat(member(shop, uid)).containsEntry("role", "STAFF").containsEntry("active", true);
        // Someone new gets nothing until the link is confirmed.
        String newcomer = ssoSignIn(UUID.randomUUID().toString(), uniqueEmail("pf-down-new"),
                List.of(org(orgId, "MEMBER"))).path("data").path("user").path("id").asText();
        assertThat(member(shop, newcomer)).isNull();
        assertThat(jdbc.queryForObject("select platform_org_id::text from business where id = ?::uuid", String.class,
                shop)).isEqualTo(orgId);
    }

    @Test
    void the_owner_row_and_hand_added_staff_are_never_changed() throws Exception {
        String ownerEmail = uniqueEmail("pf-own2");
        Session owner = signUp("Shop Owner", ownerEmail, PASSWORD);
        String shop = newShop(owner);
        String orgId = UUID.randomUUID().toString();
        linkShop(shop, orgId);
        String ownerId = owner.user().path("id").asText();

        // The owner signs in through the platform (as a plain MEMBER there): still OWNER here.
        String ownerSub = UUID.randomUUID().toString();
        jdbc.update("insert into user_identity (id, provider, subject, user_id) values (?::uuid, 'PLATFORM', ?, ?::uuid)",
                UUID.randomUUID().toString(), ownerSub, ownerId);
        ssoSignIn(ownerSub, ownerEmail, List.of(org(orgId, "MEMBER")));
        assertThat(member(shop, ownerId)).containsEntry("role", "OWNER").containsEntry("platform_managed", false);
        ssoSignIn(ownerSub, ownerEmail, List.of());
        assertThat(member(shop, ownerId)).containsEntry("role", "OWNER").containsEntry("active", true);

        // Staff added by hand keep the role the shop gave them.
        String staffEmail = uniqueEmail("pf-manual");
        Session staff = signUp("Hand Added", staffEmail, PASSWORD);
        String staffId = staff.user().path("id").asText();
        jdbc.update("insert into business_member (id, business_id, user_id, name, role, active) "
                + "values (?::uuid, ?::uuid, ?::uuid, 'Hand Added', 'STAFF', true)", UUID.randomUUID().toString(), shop,
                staffId);
        String staffSub = UUID.randomUUID().toString();
        jdbc.update("insert into user_identity (id, provider, subject, user_id) values (?::uuid, 'PLATFORM', ?, ?::uuid)",
                UUID.randomUUID().toString(), staffSub, staffId);
        ssoSignIn(staffSub, staffEmail, List.of(org(orgId, "ADMIN")));
        assertThat(member(shop, staffId)).containsEntry("role", "STAFF").containsEntry("platform_managed", false);
        ssoSignIn(staffSub, staffEmail, List.of());
        assertThat(member(shop, staffId)).containsEntry("active", true);
    }

    @Test
    void open_returns_the_shop_to_open_when_the_person_works_there() throws Exception {
        Session owner = signUp("Shop Owner", uniqueEmail("pf-open"), PASSWORD);
        String shop = newShop(owner);
        String orgId = UUID.randomUUID().toString();
        linkShop(shop, orgId);
        Started s = start(Map.of("intent", "open", "businessId", shop));
        JsonNode r = body(complete(s, sign(claims(UUID.randomUUID().toString(), uniqueEmail("pf-opener"), s.nonce(),
                List.of(org(orgId, "MEMBER"))), key)));
        assertThat(r.path("data").path("intent").asText()).isEqualTo("open");
        assertThat(r.path("data").path("business").path("id").asText()).isEqualTo(shop);
        assertThat(r.path("data").path("business").path("type").asText()).isEqualTo("PRODUCT");
        assertThat(r.path("data").path("business").path("role").asText()).isEqualTo("STAFF");

        // Not in the organisation: signed in, but no shop to open.
        Started s2 = start(Map.of("intent", "open", "businessId", shop));
        JsonNode r2 = body(complete(s2, sign(claims(UUID.randomUUID().toString(), uniqueEmail("pf-outsider"),
                s2.nonce(), List.of()), key)));
        assertThat(code(r2)).isEqualTo("SUCCESS");
        assertThat(r2.path("data").path("business").isMissingNode() || r2.path("data").path("business").isNull())
                .isTrue();

        // open needs a shop.
        assertThat(code(body(mvc.perform(postJson("/api/auth/platform/start", Map.of("intent", "open"))).andReturn())))
                .isEqualTo("VALIDATION_FAILED");
    }

    // ── Connect ───────────────────────────────────────────────────────────────────────

    @Test
    void the_owner_connects_a_shop_to_an_organisation_they_run_and_disconnects_it() throws Exception {
        String ownerEmail = uniqueEmail("pf-conn");
        Session owner = signUp("Connect Owner", ownerEmail, PASSWORD);
        String shop = newShop(owner);
        String orgId = UUID.randomUUID().toString();
        String memberOrg = UUID.randomUUID().toString();
        String path = "/api/businesses/" + shop + "/platform/connect";

        // No platform sign-in yet.
        JsonNode notLinked = body(mvc.perform(postJson(path, Map.of("orgId", orgId)).header("Authorization",
                owner.bearer())).andReturn());
        assertThat(meta(notLinked).path("reason").asText()).isEqualTo("NOT_LINKED");

        // Sign in through the platform (link the existing account), with fresh organisation roles.
        Started s = start(Map.of("intent", "connect", "orgId", orgId));
        JsonNode lr = body(complete(s, sign(claims(UUID.randomUUID().toString(), ownerEmail, s.nonce(),
                List.of(org(orgId, "ADMIN"), org(memberOrg, "MEMBER"))), key)));
        assertThat(code(lr)).isEqualTo("LINK_REQUIRED");
        JsonNode route = body(mvc.perform(postJson("/api/auth/platform/link", Map.of("ticket",
                meta(lr).path("ticket").asText())).header("Authorization", owner.bearer()).cookie(s.binding()))
                .andReturn()).path("data");
        assertThat(route.path("intent").asText()).isEqualTo("connect");
        assertThat(route.path("orgId").asText()).isEqualTo(orgId);
        assertThat(route.path("orgs")).hasSize(2);

        // Only an organisation they own or administer.
        JsonNode notAdmin = body(mvc.perform(postJson(path, Map.of("orgId", memberOrg)).header("Authorization",
                owner.bearer())).andReturn());
        assertThat(meta(notAdmin).path("reason").asText()).isEqualTo("NOT_ORG_ADMIN");

        // Only the owner (a manager can't).
        Session manager = signUp("A Manager", uniqueEmail("pf-mgr"), PASSWORD);
        jdbc.update("insert into business_member (id, business_id, user_id, name, role, active) "
                + "values (?::uuid, ?::uuid, ?::uuid, 'A Manager', 'MANAGER', true)", UUID.randomUUID().toString(), shop,
                manager.user().path("id").asText());
        JsonNode notOwner = body(mvc.perform(postJson(path, Map.of("orgId", orgId)).header("Authorization",
                manager.bearer())).andReturn());
        assertThat(meta(notOwner).path("reason").asText()).isEqualTo("NOT_OWNER");
        verify(platform, never()).putLink(any(), any(), anyString(), anyString());

        JsonNode ok = body(mvc.perform(postJson(path, Map.of("orgId", orgId)).header("Authorization", owner.bearer()))
                .andReturn());
        assertThat(code(ok)).isEqualTo("SUCCESS");
        assertThat(ok.path("data").path("linked").asBoolean()).isTrue();
        assertThat(ok.path("data").path("orgId").asText()).isEqualTo(orgId);
        String sub = jdbc.queryForObject("select subject from user_identity where user_id = ?::uuid", String.class,
                owner.user().path("id").asText());
        verify(platform).putLink(UUID.fromString(shop), UUID.fromString(orgId), "Linked Shop", sub);
        assertThat(jdbc.queryForObject("select platform_org_id::text from business where id = ?::uuid", String.class,
                shop)).isEqualTo(orgId);
        assertThat(body(mvc.perform(get("/api/businesses/" + shop + "/platform").header("Authorization",
                manager.bearer())).andReturn()).path("data").path("canManage").asBoolean()).isFalse();

        // A platform member gets staff access, then loses it when the shop is disconnected.
        JsonNode staff = ssoSignIn(UUID.randomUUID().toString(), uniqueEmail("pf-st"), List.of(org(orgId, "MEMBER")));
        String staffId = staff.path("data").path("user").path("id").asText();
        assertThat(member(shop, staffId)).containsEntry("active", true);

        JsonNode off = body(mvc.perform(delete(path).header("Authorization", owner.bearer())).andReturn());
        assertThat(off.path("data").path("linked").asBoolean()).isFalse();
        verify(platform).deleteLink(UUID.fromString(shop));
        assertThat(member(shop, staffId)).containsEntry("active", false);
        assertThat(jdbc.queryForObject("select count(*) from shop_activity where business_id = ?::uuid and action in "
                + "('PLATFORM_CONNECTED','PLATFORM_DISCONNECTED')", Integer.class, shop)).isEqualTo(2);

        // Roles older than the connect window: sign in again first.
        jdbc.update("update user_identity set claims_at = now() - interval '1 hour' where user_id = ?::uuid",
                owner.user().path("id").asText());
        JsonNode stale = body(mvc.perform(postJson(path, Map.of("orgId", orgId)).header("Authorization", owner.bearer()))
                .andReturn());
        assertThat(meta(stale).path("reason").asText()).isEqualTo("SIGN_IN_AGAIN");
    }

    @Test
    void the_platform_refusing_a_link_leaves_the_shop_unlinked() throws Exception {
        String ownerEmail = uniqueEmail("pf-refused");
        Session owner = signUp("Refused Owner", ownerEmail, PASSWORD);
        String shop = newShop(owner);
        String orgId = UUID.randomUUID().toString();
        String sub = UUID.randomUUID().toString();
        jdbc.update("insert into user_identity (id, provider, subject, user_id, orgs, claims_at) values "
                + "(?::uuid, 'PLATFORM', ?, ?::uuid, ?::jsonb, now())", UUID.randomUUID().toString(), sub,
                owner.user().path("id").asText(), json.writeValueAsString(new ArrayList<>(List.of(org(orgId, "OWNER")))));
        doThrow(BusinessException.withDetail(StatusCode.FORBIDDEN, "orgId", "no", Map.of("reason", "PLATFORM_FORBIDDEN")))
                .when(platform).putLink(any(), any(), anyString(), anyString());
        JsonNode r = body(mvc.perform(postJson("/api/businesses/" + shop + "/platform/connect", Map.of("orgId", orgId))
                .header("Authorization", owner.bearer())).andReturn());
        assertThat(meta(r).path("reason").asText()).isEqualTo("PLATFORM_FORBIDDEN");
        assertThat(jdbc.queryForObject("select platform_org_id from business where id = ?::uuid", String.class, shop))
                .isNull();
    }

    private static String sha256Hex(String s) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(s.getBytes(StandardCharsets.UTF_8)));
    }
}
