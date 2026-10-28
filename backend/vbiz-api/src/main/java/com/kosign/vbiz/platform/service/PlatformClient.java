package com.kosign.vbiz.platform.service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.nimbusds.jose.jwk.JWKSet;

import lombok.extern.slf4j.Slf4j;

/**
 * The calls VirtualBiz makes to the Business Platform (contract: business-platform
 * docs/integrations/virtualbiz-sso.md): discovery, the code exchange and the key set, and the
 * shop-link API. Client authentication is HTTP Basic with the client id and secret. Nothing here
 * logs a code, a token or the secret.
 */
@Slf4j
@Component
public class PlatformClient {

    static final String DISCOVERY_PATH = "/api/oidc/.well-known/openid-configuration";
    static final String LINKS_PATH = "/api/integrations/virtualbiz/links/";
    private static final Duration DISCOVERY_TTL = Duration.ofHours(1);

    private final PlatformProperties props;
    private final ObjectMapper json;
    private final Clock clock;
    private final RestClient http;
    private volatile Discovery discovery;
    private volatile Instant discoveredAt = Instant.EPOCH;

    public PlatformClient(PlatformProperties props, ObjectMapper json, Clock clock) {
        this.props = props;
        this.json = json;
        this.clock = clock;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.connectTimeout());
        factory.setReadTimeout(props.readTimeout());
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    /** The platform's OpenID configuration (the endpoints), cached for an hour. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Discovery(
            @JsonProperty("issuer") String issuer,
            @JsonProperty("authorization_endpoint") String authorizationEndpoint,
            @JsonProperty("token_endpoint") String tokenEndpoint,
            @JsonProperty("jwks_uri") String jwksUri) {
    }

    public Discovery discovery() {
        Discovery d = discovery;
        if (d != null && clock.instant().isBefore(discoveredAt.plus(DISCOVERY_TTL))) {
            return d;
        }
        try {
            Discovery fetched = http.get().uri(props.url() + DISCOVERY_PATH).retrieve().body(Discovery.class);
            if (fetched == null || blank(fetched.authorizationEndpoint()) || blank(fetched.tokenEndpoint())
                    || blank(fetched.jwksUri())) {
                throw new IllegalStateException("incomplete discovery document");
            }
            discovery = fetched;
            discoveredAt = clock.instant();
            return fetched;
        } catch (RuntimeException ex) {
            if (d != null) {
                log.warn("[PLATFORM] Discovery refresh failed ({}); keeping the cached endpoints", ex.getMessage());
                return d;
            }
            log.error("[PLATFORM] Discovery failed: {}", ex.getMessage());
            throw new BusinessException(StatusCode.PLATFORM_UNAVAILABLE, ex);
        }
    }

    /**
     * Trades the authorization code for the ID token. {@code INVALID_TOKEN} when the platform
     * refuses the code ({@code invalid_grant}: unknown, used, expired, wrong redirect or PKCE);
     * {@code PLATFORM_UNAVAILABLE} for anything else.
     */
    public String exchange(String code, String codeVerifier, String redirectUri) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("redirect_uri", redirectUri);
        form.add("code_verifier", codeVerifier);
        try {
            JsonNode body = http.post().uri(discovery().tokenEndpoint())
                    .headers(this::basicAuth)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(form)
                    .retrieve()
                    .body(JsonNode.class);
            String idToken = body == null ? null : body.path("id_token").asText(null);
            if (blank(idToken)) {
                throw new IllegalStateException("no id_token in the token response");
            }
            return idToken;
        } catch (HttpStatusCodeException ex) {
            String error = oauthError(ex);
            if ("invalid_grant".equals(error)) {
                log.info("[PLATFORM] The platform refused the sign-in code (invalid_grant)");
                throw BusinessException.withDetail(StatusCode.INVALID_TOKEN, "code",
                        "The sign-in code is invalid or expired");
            }
            log.error("[PLATFORM] Token exchange failed: HTTP {} {}", ex.getStatusCode().value(), error);
            throw new BusinessException(StatusCode.PLATFORM_UNAVAILABLE, ex);
        } catch (BusinessException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            log.error("[PLATFORM] Token exchange failed: {}", ex.getMessage());
            throw new BusinessException(StatusCode.PLATFORM_UNAVAILABLE, ex);
        }
    }

    /** The platform's signing keys (JWKS). */
    public JWKSet jwks() {
        try {
            String body = http.get().uri(discovery().jwksUri()).retrieve().body(String.class);
            return JWKSet.parse(body == null ? "" : body);
        } catch (BusinessException ex) {
            throw ex;
        } catch (RuntimeException | ParseException ex) {
            log.error("[PLATFORM] Key set fetch failed: {}", ex.getMessage());
            throw new BusinessException(StatusCode.PLATFORM_UNAVAILABLE, ex);
        }
    }

    /**
     * {@code PUT …/links/{businessId}}: links the shop to the organisation (moves it if it was linked
     * elsewhere). {@code FORBIDDEN} when the platform says {@code linkedBy} may not.
     */
    public void putLink(UUID businessId, UUID orgId, String businessName, String linkedBy) {
        try {
            http.put().uri(props.url() + LINKS_PATH + businessId)
                    .headers(this::basicAuth)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("orgId", orgId.toString(), "businessName", businessName, "linkedBy", linkedBy))
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() == HttpStatus.FORBIDDEN.value()) {
                throw BusinessException.withDetail(StatusCode.FORBIDDEN, "orgId",
                        "The Business Platform says you can't link shops to this organisation",
                        Map.of("reason", "PLATFORM_FORBIDDEN"));
            }
            log.error("[PLATFORM] Linking shop {} failed: HTTP {}", businessId, ex.getStatusCode().value());
            throw new BusinessException(StatusCode.PLATFORM_UNAVAILABLE, ex);
        } catch (RestClientException ex) {
            log.error("[PLATFORM] Linking shop {} failed: {}", businessId, ex.getMessage());
            throw new BusinessException(StatusCode.PLATFORM_UNAVAILABLE, ex);
        }
    }

    /** What the platform says about a shop's link: linked (to {@code orgId}), not linked, or unknown (unreachable). */
    public record LinkState(Status status, UUID orgId) {

        public enum Status {
            LINKED, NOT_LINKED, UNKNOWN
        }

        public static LinkState linked(UUID orgId) {
            return new LinkState(Status.LINKED, orgId);
        }

        public static final LinkState NOT_LINKED = new LinkState(Status.NOT_LINKED, null);
        public static final LinkState UNKNOWN = new LinkState(Status.UNKNOWN, null);
    }

    /**
     * {@code GET …/links/{businessId}}: whether the platform still links the shop (an admin can unlink
     * it there, and the platform can't call VirtualBiz). 404 → NOT_LINKED; anything unexpected
     * (network, 5xx, bad body) → UNKNOWN, never an exception.
     */
    public LinkState checkLink(UUID businessId) {
        try {
            JsonNode body = http.get().uri(props.url() + LINKS_PATH + businessId)
                    .headers(this::basicAuth)
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(JsonNode.class);
            String org = body == null ? null : body.path("orgId").asText(null);
            return org == null ? LinkState.UNKNOWN : LinkState.linked(UUID.fromString(org));
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                return LinkState.NOT_LINKED;
            }
            log.warn("[PLATFORM] Checking the link of shop {} failed: HTTP {}", businessId, ex.getStatusCode().value());
            return LinkState.UNKNOWN;
        } catch (RuntimeException ex) {
            log.warn("[PLATFORM] Checking the link of shop {} failed: {}", businessId, ex.getMessage());
            return LinkState.UNKNOWN;
        }
    }

    /** {@code DELETE …/links/{businessId}}; a link the platform no longer has counts as removed. */
    public void deleteLink(UUID businessId) {
        try {
            http.delete().uri(props.url() + LINKS_PATH + businessId)
                    .headers(this::basicAuth)
                    .retrieve()
                    .toBodilessEntity();
        } catch (HttpStatusCodeException ex) {
            if (ex.getStatusCode().value() == HttpStatus.NOT_FOUND.value()) {
                return;
            }
            log.error("[PLATFORM] Unlinking shop {} failed: HTTP {}", businessId, ex.getStatusCode().value());
            throw new BusinessException(StatusCode.PLATFORM_UNAVAILABLE, ex);
        } catch (RestClientException ex) {
            log.error("[PLATFORM] Unlinking shop {} failed: {}", businessId, ex.getMessage());
            throw new BusinessException(StatusCode.PLATFORM_UNAVAILABLE, ex);
        }
    }

    /** RFC 6749 §2.3.1: id and secret form-encoded, then Basic. */
    private void basicAuth(HttpHeaders h) {
        h.setBasicAuth(URLEncoder.encode(props.clientId(), StandardCharsets.UTF_8),
                URLEncoder.encode(props.clientSecret(), StandardCharsets.UTF_8));
    }

    private String oauthError(HttpStatusCodeException ex) {
        try {
            return json.readTree(ex.getResponseBodyAsString()).path("error").asText("unknown");
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
