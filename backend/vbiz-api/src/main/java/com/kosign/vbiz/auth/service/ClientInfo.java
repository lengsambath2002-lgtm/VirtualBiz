package com.kosign.vbiz.auth.service;

/** Where a sign-in came from, recorded on the session row. */
public record ClientInfo(String userAgent, String ip) {

    public static final ClientInfo UNKNOWN = new ClientInfo(null, null);

    public ClientInfo {
        if (userAgent != null && userAgent.length() > 300) {
            userAgent = userAgent.substring(0, 300);
        }
        if (ip != null && ip.length() > 64) {
            ip = ip.substring(0, 64);
        }
    }
}
