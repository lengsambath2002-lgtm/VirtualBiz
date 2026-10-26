package com.kosign.vbiz.auth.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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
     * {@link #issue} in its own transaction, so the ticket outlives a caller that then fails (a
     * sign-in that answers TWO_STEP_REQUIRED rolls back).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String issueSeparately(TicketKind kind, UUID userId, String target) {
        return issue(kind, userId, target);
    }

    /**
     * The live ticket, locked for the caller's transaction and not used up (the caller decides).
     * {@code INVALID_TOKEN} when unknown, of another kind, used or expired. Not transactional itself,
     * so that error doesn't mark a caller's {@code noRollbackFor} transaction for rollback.
     */
    public AuthTicket open(TicketKind kind, String token, String field) {
        AuthTicket t = token == null || token.isBlank() ? null
                : tickets.findByTokenHashForUpdate(SecureTokens.sha256Hex(token)).orElse(null);
        if (t == null || t.getKind() != kind || t.getConsumedAt() != null || !t.getExpiresAt().isAfter(clock.instant())) {
            throw BusinessException.withDetail(StatusCode.INVALID_TOKEN, field, "Token is invalid or expired");
        }
        return t;
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
