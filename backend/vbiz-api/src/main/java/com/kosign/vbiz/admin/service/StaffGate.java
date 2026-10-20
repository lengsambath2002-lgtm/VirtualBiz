package com.kosign.vbiz.admin.service;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.admin.domain.MfaSession;
import com.kosign.vbiz.admin.repository.MfaSessionRepository;
import com.kosign.vbiz.auth.domain.UserSession;
import com.kosign.vbiz.auth.repository.UserSessionRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.security.CurrentUser;

import lombok.RequiredArgsConstructor;

/**
 * What a staff member's session must have done before the console answers it, in order: a
 * forced password change ({@code PASSWORD_CHANGE_REQUIRED}), two-step sign-in set up
 * ({@code MFA_SETUP_REQUIRED}) and passed within {@code vbiz.staff.mfa-ttl} on this sign-in
 * ({@code MFA_REQUIRED}). The last two apply while {@code vbiz.staff.mfa-required}.
 */
@Component
@RequiredArgsConstructor
public class StaffGate {

    private final StaffProperties props;
    private final MfaSessionRepository mfaSessions;
    private final UserSessionRepository sessions;
    private final Clock clock;

    public void check(User u) {
        if (u.isMustChangePassword()) {
            throw new BusinessException(StatusCode.PASSWORD_CHANGE_REQUIRED);
        }
        if (!props.mfaRequired()) {
            return;
        }
        if (!u.hasMfa()) {
            throw new BusinessException(StatusCode.MFA_SETUP_REQUIRED);
        }
        if (verifiedUntil(u.getId()).filter(t -> t.isAfter(clock.instant())).isEmpty()) {
            throw new BusinessException(StatusCode.MFA_REQUIRED);
        }
    }

    /** When this sign-in's two-step check runs out, if it passed. */
    public Optional<Instant> verifiedUntil(UUID userId) {
        return currentFamily().flatMap(mfaSessions::findById)
                .filter(s -> s.getUserId().equals(userId) && s.getVerifiedAt() != null)
                .map(MfaSession::getVerifiedAt).map(v -> v.plus(props.mfaTtl()));
    }

    /** The refresh-token family of the request's session (stable across token rotation). */
    public Optional<UUID> currentFamily() {
        return CurrentUser.principal().map(p -> p.sessionId()).filter(java.util.Objects::nonNull)
                .flatMap(sessions::findById).map(UserSession::getFamilyId);
    }
}
