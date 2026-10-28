package com.kosign.vbiz.platform.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.service.UserService;
import com.kosign.vbiz.auth.domain.AuthTicket;
import com.kosign.vbiz.auth.domain.SignInMethod;
import com.kosign.vbiz.auth.domain.TicketKind;
import com.kosign.vbiz.auth.payload.AuthResult;
import com.kosign.vbiz.auth.service.AuthService;
import com.kosign.vbiz.auth.service.ClientInfo;
import com.kosign.vbiz.auth.service.TicketService;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.business.service.MembershipService;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.Emails;
import com.kosign.vbiz.common.logging.LogMask;
import com.kosign.vbiz.common.security.SecretBox;
import com.kosign.vbiz.common.security.SecureTokens;
import com.kosign.vbiz.platform.domain.IdentityProvider;
import com.kosign.vbiz.platform.domain.PlatformOrg;
import com.kosign.vbiz.platform.domain.UserIdentity;
import com.kosign.vbiz.platform.payload.PlatformRoute;
import com.kosign.vbiz.platform.repository.UserIdentityRepository;
import com.kosign.vbiz.platform.service.PlatformTokenVerifier.PlatformIdentity;

import lombok.extern.slf4j.Slf4j;

/**
 * Single sign-on with the Business Platform, VirtualBiz side (contract: business-platform
 * docs/integrations/virtualbiz-sso.md §6; docs/adr/0003-sso-with-the-business-platform.md).
 *
 * <ul>
 * <li><b>start</b>: a random {@code state}, {@code nonce} and S256 PKCE verifier kept in a hashed
 * {@code SSO_STATE} ticket (10 minutes, single use) with the intent, plus a browser binding (a
 * cookie whose hash is on the ticket, so a callback can only finish in the browser that started it).</li>
 * <li><b>complete</b>: exchange the code, verify the ID token, resolve the person by
 * {@code (PLATFORM, sub)} only (a same-email account gets {@code LINK_REQUIRED}, never a link),
 * sync platform-managed staff and sign in through the normal path (suspension, two-step).</li>
 * <li><b>link</b>: the account the email matched, signed in the usual way, confirms the link.</li>
 * </ul>
 */
@Slf4j
@Service
public class PlatformAuthService {

    public static final String SCOPE = "openid email profile orgs";

    private final PlatformProperties props;
    private final PlatformClient client;
    private final PlatformTokenVerifier verifier;
    private final PlatformStaffSync staff;
    private final UserIdentityRepository identities;
    private final UserService users;
    private final AuthService auth;
    private final TicketService tickets;
    private final MembershipService membership;
    private final BusinessRepository businesses;
    private final SecretBox box;
    private final Clock clock;
    private final TransactionTemplate tx;

    public PlatformAuthService(PlatformProperties props, PlatformClient client, PlatformTokenVerifier verifier,
            PlatformStaffSync staff, UserIdentityRepository identities, UserService users, AuthService auth,
            TicketService tickets, MembershipService membership, BusinessRepository businesses, SecretBox box,
            Clock clock, PlatformTransactionManager txManager) {
        this.props = props;
        this.client = client;
        this.verifier = verifier;
        this.staff = staff;
        this.identities = identities;
        this.users = users;
        this.auth = auth;
        this.tickets = tickets;
        this.membership = membership;
        this.businesses = businesses;
        this.box = box;
        this.clock = clock;
        this.tx = new TransactionTemplate(txManager);
    }

    /** Whether platform sign-in is set up on this server ({@code GET /api/auth/methods}). */
    public boolean available() {
        return props.configured();
    }

    /** The authorize URL to send the browser to, and the browser binding to set as a cookie. */
    public record Started(String authorizeUrl, String binding) {
    }

    /** A finished platform sign-in: the session (and refresh token) plus where to go. */
    public record Completed(AuthResult auth, PlatformRoute route) {
    }

    // ── Start ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public Started start(String intent, String rawBusinessId, String rawOrgId, String rawNext) {
        requireConfigured();
        String businessId = uuidOrNull(rawBusinessId, "businessId");
        String orgId = uuidOrNull(rawOrgId, "orgId");
        if ("open".equals(intent) && businessId == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "businessId", "Which shop to open");
        }
        String nonce = SecureTokens.randomToken();
        String codeVerifier = SecureTokens.randomToken(); // 43 URL-safe characters (RFC 7636 §4.1)
        String binding = SecureTokens.randomToken();

        Map<String, Object> data = new HashMap<>();
        data.put("intent", intent);
        data.put("businessId", businessId);
        data.put("orgId", orgId);
        data.put("next", safeNext(rawNext));
        data.put("verifier", box.seal(codeVerifier));
        data.put("nonce", SecureTokens.sha256Hex(nonce));
        data.put("binding", SecureTokens.sha256Hex(binding));
        // The ticket's token is the state: stored hashed, single use, 10 minutes.
        String state = tickets.issue(TicketKind.SSO_STATE, null, intent, data);

        String url = UriComponentsBuilder.fromUriString(client.discovery().authorizationEndpoint())
                .queryParam("response_type", "code")
                .queryParam("client_id", props.clientId())
                .queryParam("redirect_uri", props.redirectUri())
                .queryParam("scope", SCOPE)
                .queryParam("state", state)
                .queryParam("nonce", nonce)
                .queryParam("code_challenge", challenge(codeVerifier))
                .queryParam("code_challenge_method", "S256")
                .encode()
                .build()
                .toUriString();
        log.info("[PLATFORM] Sign-in started (intent {})", intent);
        return new Started(url, binding);
    }

    // ── Complete ──────────────────────────────────────────────────────────────────────

    /**
     * Errors: {@code INVALID_TOKEN} (state unknown, used, expired or from another browser; code
     * refused; ID token fails a check), {@code LINK_REQUIRED} ({@code meta.ticket}, {@code meta.email}
     * masked, {@code meta.name}), {@code TWO_STEP_REQUIRED} ({@code meta.ticket} plus {@code meta.route}),
     * {@code ACCOUNT_SUSPENDED}, {@code PLATFORM_UNAVAILABLE}, {@code NOT_CONFIGURED}.
     */
    public Completed complete(String code, String state, String binding, ClientInfo info) {
        requireConfigured();
        // Used up whatever happens next: a state is good for one try.
        AuthTicket t = tickets.consumeSeparately(TicketKind.SSO_STATE, state, "state");
        Map<String, Object> data = t.getData() == null ? Map.of() : t.getData();
        requireBinding(data, binding, "state");
        String idToken = client.exchange(code, box.open(str(data.get("verifier"))), props.redirectUri());
        PlatformIdentity id = verifier.verify(idToken, str(data.get("nonce")));

        Resolved r = tx.execute(status -> resolve(id, data));
        if (r.linkTicket() != null) {
            log.info("[PLATFORM] Sign-in for an existing email: the account must confirm the link");
            throw BusinessException.withDetail(StatusCode.LINK_REQUIRED, "ticket",
                    "Sign in to your VirtualBiz account to link it",
                    Map.of("ticket", r.linkTicket(), "email", LogMask.contact(r.email()),
                            "name", id.name() == null ? "" : id.name()));
        }
        PlatformRoute route = route(r.user().getId(), data, id.orgs());
        try {
            AuthResult result = auth.signInFromPlatform(r.user(), info);
            log.info("[PLATFORM] User {} signed in through the platform", r.user().getId());
            return new Completed(result, route);
        } catch (BusinessException ex) {
            if (ex.getStatusCode() == StatusCode.TWO_STEP_REQUIRED && ex.getMeta() != null) {
                Map<String, Object> meta = new LinkedHashMap<>(ex.getMeta());
                meta.put("route", route);
                throw BusinessException.withDetail(StatusCode.TWO_STEP_REQUIRED, ex.getField(), ex.getMessage(), meta);
            }
            throw ex;
        }
    }

    /** Who the token is: a linked user, or (same email, not linked) a link ticket. */
    private record Resolved(User user, String linkTicket, String email) {
    }

    private Resolved resolve(PlatformIdentity id, Map<String, Object> data) {
        UserIdentity identity = identities.findByProviderAndSubject(IdentityProvider.PLATFORM, id.subject())
                .orElse(null);
        User user;
        if (identity != null) {
            user = users.require(identity.getUserId());
            if (user.isSuspended()) {
                throw new BusinessException(StatusCode.ACCOUNT_SUSPENDED);
            }
        } else {
            if (id.email() == null || id.email().isBlank()) {
                throw BusinessException.withDetail(StatusCode.INVALID_TOKEN, "code", "The platform account has no email");
            }
            String email = Emails.normalizeOrThrow(id.email(), "code");
            User sameEmail = users.findByEmail(email).orElse(null);
            if (sameEmail != null) {
                // Never link on email alone (the platform does not verify emails): the account proves itself first.
                Map<String, Object> link = new HashMap<>();
                link.put("sub", id.subject());
                link.put("email", email);
                link.put("name", id.name());
                link.put("locale", id.locale());
                link.put("orgs", orgsToData(id.orgs()));
                link.put("intent", data.get("intent"));
                link.put("businessId", data.get("businessId"));
                link.put("orgId", data.get("orgId"));
                link.put("next", data.get("next"));
                link.put("binding", data.get("binding"));
                String ticket = tickets.issue(TicketKind.SSO_LINK, sameEmail.getId(), id.subject(), link);
                return new Resolved(null, ticket, sameEmail.getEmail());
            }
            user = users.save(User.create(displayName(id.name(), email), email, null));
            identity = newIdentity(id.subject(), user.getId());
            log.info("[PLATFORM] New account {} made from a platform sign-in", user.getId());
        }
        updateClaims(identity, id.email(), id.name(), id.locale(), id.orgs());
        identity.setLastSignInAt(clock.instant());
        identities.save(identity);
        staff.sync(user, id.orgs());
        return new Resolved(user, null, null);
    }

    // ── Link ──────────────────────────────────────────────────────────────────────────

    /**
     * The signed-in account confirms the link a {@code LINK_REQUIRED} answer offered. Only the
     * account the email matched, in the browser that started the sign-in. Errors: INVALID_TOKEN,
     * FORBIDDEN ({@code meta.reason} WRONG_ACCOUNT), CONFLICT (already linked elsewhere).
     */
    @Transactional
    public PlatformRoute link(UUID userId, String ticket, String binding) {
        requireConfigured();
        AuthTicket t = tickets.open(TicketKind.SSO_LINK, ticket, "ticket");
        Map<String, Object> data = t.getData() == null ? Map.of() : t.getData();
        requireBinding(data, binding, "ticket");
        if (!userId.equals(t.getUserId())) {
            throw BusinessException.withDetail(StatusCode.FORBIDDEN, "ticket",
                    "Sign in to the account with the platform's email to link it", Map.of("reason", "WRONG_ACCOUNT"));
        }
        User user = users.require(userId);
        if (user.isSuspended()) {
            throw new BusinessException(StatusCode.ACCOUNT_SUSPENDED);
        }
        String sub = t.getTarget();
        identities.findByProviderAndSubject(IdentityProvider.PLATFORM, sub).ifPresent(other -> {
            if (!other.getUserId().equals(userId)) {
                throw BusinessException.withDetail(StatusCode.CONFLICT, "ticket",
                        "This platform account is already linked to another VirtualBiz account");
            }
        });
        UserIdentity identity = identities.findByUserIdAndProvider(userId, IdentityProvider.PLATFORM).orElse(null);
        if (identity != null && !identity.getSubject().equals(sub)) {
            throw BusinessException.withDetail(StatusCode.CONFLICT, "ticket",
                    "This VirtualBiz account is already linked to another platform account");
        }
        if (identity == null) {
            identity = newIdentity(sub, userId);
        }
        List<PlatformOrg> orgs = orgsFromData(data.get("orgs"));
        updateClaims(identity, str(data.get("email")), str(data.get("name")), str(data.get("locale")), orgs);
        identity.setLastSignInAt(clock.instant());
        identities.save(identity);
        t.setConsumedAt(clock.instant());
        user.addSignInMethod(SignInMethod.PLATFORM);
        users.save(user);
        staff.sync(user, orgs);
        log.info("[PLATFORM] User {} linked their platform account", userId);
        return route(userId, data, orgs);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────────

    private UserIdentity newIdentity(String sub, UUID userId) {
        UserIdentity identity = new UserIdentity();
        identity.setProvider(IdentityProvider.PLATFORM);
        identity.setSubject(sub);
        identity.setUserId(userId);
        return identity;
    }

    private void updateClaims(UserIdentity identity, String email, String name, String locale, List<PlatformOrg> orgs) {
        identity.setEmail(email == null ? null : cut(email.toLowerCase(java.util.Locale.ROOT), 254));
        identity.setName(cut(name, 200));
        identity.setLocale(cut(locale, 10));
        identity.setOrgs(new ArrayList<>(orgs));
        identity.setClaimsAt(clock.instant());
    }

    private PlatformRoute route(UUID userId, Map<String, Object> data, List<PlatformOrg> orgs) {
        String businessId = str(data.get("businessId"));
        PlatformRoute.RouteBusiness business = null;
        if (businessId != null) {
            UUID bid = UUID.fromString(businessId);
            business = membership.membership(userId, bid)
                    .flatMap(m -> businesses.findById(bid)
                            .map(b -> new PlatformRoute.RouteBusiness(b.getId().toString(), b.getName(), b.getType(),
                                    m.getRole())))
                    .orElse(null);
        }
        return new PlatformRoute(str(data.get("intent")), businessId, str(data.get("orgId")), str(data.get("next")),
                orgs, business);
    }

    private void requireConfigured() {
        if (!props.configured()) {
            throw new BusinessException(StatusCode.NOT_CONFIGURED);
        }
    }

    private static void requireBinding(Map<String, Object> data, String binding, String field) {
        if (binding == null || binding.isBlank()
                || !SecureTokens.equalsConstantTime(SecureTokens.sha256Hex(binding), str(data.get("binding")))) {
            log.warn("[PLATFORM] A platform sign-in was finished in a different browser than it started in");
            throw BusinessException.withDetail(StatusCode.INVALID_TOKEN, field, "Start the sign-in again");
        }
    }

    /** RFC 7636 S256: BASE64URL(SHA256(ASCII(verifier))). */
    static String challenge(String verifier) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** A same-site path ("/orders?x=1"), else null. Locale prefixes are handled by the web app. */
    static String safeNext(String next) {
        if (next == null || next.isBlank() || next.length() > 500) {
            return null;
        }
        String n = next.trim();
        if (!n.startsWith("/") || n.startsWith("//") || n.contains("\\") || n.chars().anyMatch(c -> c < 0x20)) {
            return null;
        }
        return n;
    }

    private static String uuidOrNull(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim()).toString();
        } catch (IllegalArgumentException e) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Not an id");
        }
    }

    private static String displayName(String name, String email) {
        String n = name == null ? "" : name.trim();
        if (n.isEmpty()) {
            n = Emails.localPart(email);
        }
        return cut(n, 80);
    }

    private static List<Map<String, Object>> orgsToData(List<PlatformOrg> orgs) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (PlatformOrg o : orgs) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", o.id());
            m.put("slug", o.slug());
            m.put("name", o.name());
            m.put("role", o.role());
            out.add(m);
        }
        return out;
    }

    private static List<PlatformOrg> orgsFromData(Object raw) {
        List<PlatformOrg> out = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> m && m.get("id") != null) {
                    out.add(new PlatformOrg(str(m.get("id")), str(m.get("slug")), str(m.get("name")), str(m.get("role"))));
                }
            }
        }
        return out;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
