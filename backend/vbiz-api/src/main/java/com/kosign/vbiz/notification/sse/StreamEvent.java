package com.kosign.vbiz.notification.sse;

import java.util.Set;
import java.util.UUID;

/**
 * A live update for the customers in {@code users} and the shops in {@code businesses}. Publish it
 * with Spring's {@code ApplicationEventPublisher}; {@link StreamHub} sends it once the transaction
 * commits (or at once outside a transaction).
 */
public record StreamEvent(Set<UUID> users, Set<UUID> businesses, String name, Object data) {

    public static StreamEvent toUser(UUID userId, String name, Object data) {
        return new StreamEvent(Set.of(userId), Set.of(), name, data);
    }

    public static StreamEvent toBusiness(UUID businessId, String name, Object data) {
        return new StreamEvent(Set.of(), Set.of(businessId), name, data);
    }
}
