package com.kosign.vbiz.promotion.domain;

import java.time.Instant;

/** Derived, never stored: computed from a promotion's window and usage. */
public enum PromotionState {
    ACTIVE,
    SCHEDULED,
    USED_UP,
    ENDED;

    /**
     * Precedence: {@code ENDED} over {@code USED_UP} over {@code SCHEDULED} over {@code ACTIVE}.
     * The window is {@code [startsAt, endsAt)}; a null {@code endsAt} or {@code usageLimit} means none.
     */
    public static PromotionState derive(Instant startsAt, Instant endsAt, long uses, Long usageLimit, Instant now) {
        if (endsAt != null && !now.isBefore(endsAt)) {
            return ENDED;
        }
        if (usageLimit != null && uses >= usageLimit) {
            return USED_UP;
        }
        if (startsAt != null && now.isBefore(startsAt)) {
            return SCHEDULED;
        }
        return ACTIVE;
    }
}
