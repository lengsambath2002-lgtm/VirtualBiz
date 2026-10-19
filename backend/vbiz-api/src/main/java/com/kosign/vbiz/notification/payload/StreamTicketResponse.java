package com.kosign.vbiz.notification.payload;

/** {@code POST /api/stream/ticket}. */
public record StreamTicketResponse(String ticket, long expiresIn) {
}
