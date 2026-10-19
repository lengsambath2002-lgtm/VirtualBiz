package com.kosign.vbiz.notification.sse;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.kosign.vbiz.common.security.SecureTokens;

import lombok.RequiredArgsConstructor;

/**
 * Single-use, short-lived tickets that open a stream (EventSource cannot send the bearer header,
 * and the access token must never travel in a URL). Only the ticket's hash is kept.
 */
@Service
@RequiredArgsConstructor
public class StreamTicketService {

    public static final Duration TTL = Duration.ofSeconds(60);

    /** What a ticket opens: the user's stream, and the shop's when issued with X-Business-Id. */
    public record Grant(UUID userId, UUID businessId, Instant expiresAt) {
    }

    private final Clock clock;
    private final Map<String, Grant> tickets = new ConcurrentHashMap<>();

    public String issue(UUID userId, UUID businessId) {
        String ticket = SecureTokens.randomToken();
        tickets.put(SecureTokens.sha256Hex(ticket), new Grant(userId, businessId, clock.instant().plus(TTL)));
        return ticket;
    }

    /** The grant of a valid ticket, which is used up; empty for a missing, used or expired one. */
    public Optional<Grant> redeem(String ticket) {
        if (ticket == null || ticket.isBlank() || ticket.length() > 100) {
            return Optional.empty();
        }
        Grant g = tickets.remove(SecureTokens.sha256Hex(ticket));
        if (g == null || !g.expiresAt().isAfter(clock.instant())) {
            return Optional.empty();
        }
        return Optional.of(g);
    }

    @Scheduled(fixedRate = 60_000)
    public void purge() {
        Instant now = clock.instant();
        tickets.values().removeIf(g -> !g.expiresAt().isAfter(now));
    }
}
