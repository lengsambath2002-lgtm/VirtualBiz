package com.kosign.vbiz.platform.payload;

import java.time.Instant;

/**
 * A shop's link to a Business Platform organisation. {@code available}: platform sign-in is set up
 * on this server; {@code canManage}: the caller owns the shop (connects and disconnects).
 */
public record PlatformShopLinkResponse(boolean available, boolean linked, String orgId, String orgName,
        Instant linkedAt, boolean canManage) {
}
