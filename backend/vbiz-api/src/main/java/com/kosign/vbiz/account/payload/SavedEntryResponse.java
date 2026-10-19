package com.kosign.vbiz.account.payload;

import java.time.Instant;

import com.kosign.vbiz.account.domain.SavedTarget;

/** A saved item / followed shop; {@code key} is the client's key ({@code latte}, {@code shop:happy-coffee}). */
public record SavedEntryResponse(String key, SavedTarget type, String id, Instant savedAt) {
}
