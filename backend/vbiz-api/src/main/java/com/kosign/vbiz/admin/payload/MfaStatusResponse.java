package com.kosign.vbiz.admin.payload;

import java.time.Instant;

/**
 * {@code GET /api/staff/security}: what stands between this staff member and the console, in
 * order: a forced password change, then two-step sign-in set up, then this session's check.
 */
public record MfaStatusResponse(boolean staff, boolean mustChangePassword, boolean mfaRequired, boolean enrolled,
        boolean verified, Instant verifiedUntil, long recoveryCodesLeft) {
}
