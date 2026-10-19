package com.kosign.vbiz.auth.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.auth.domain.AuthTicket;
import com.kosign.vbiz.auth.domain.TicketKind;
import com.kosign.vbiz.auth.repository.AuthTicketRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.SecureTokens;

import lombok.RequiredArgsConstructor;

/** Single-use tickets ({@code resetToken}, {@code phoneToken}), valid 10 minutes, stored hashed. */
@Service
@RequiredArgsConstructor
public class TicketService {

    public static final Duration TTL = Duration.ofMinutes(10);

    private final AuthTicketRepository tickets;
    private final Clock clock;

    /** Returns the plain token. */
    @Transactional
    public String issue(TicketKind kind, UUID userId, String target) {
        String token = SecureTokens.randomToken();
        AuthTicket t = new AuthTicket();
        t.setKind(kind);
        t.setUserId(userId);
        t.setTarget(target);
        t.setTokenHash(SecureTokens.sha256Hex(token));
        t.setExpiresAt(clock.instant().plus(TTL));
        tickets.save(t);
        return token;
    }

    /**
     * Marks the ticket used, in the caller's transaction (so a later validation failure leaves it
     * usable). {@code INVALID_TOKEN} when unknown, of another kind, used or expired.
     */
    @Transactional
    public AuthTicket consume(TicketKind kind, String token, String field) {
        Instant now = clock.instant();
        AuthTicket t = token == null || token.isBlank() ? null
                : tickets.findByTokenHash(SecureTokens.sha256Hex(token)).orElse(null);
        if (t == null || t.getKind() != kind || t.getConsumedAt() != null || !t.getExpiresAt().isAfter(now)) {
            throw BusinessException.withDetail(StatusCode.INVALID_TOKEN, field, "Token is invalid or expired");
        }
        t.setConsumedAt(now);
        return tickets.save(t);
    }
}
