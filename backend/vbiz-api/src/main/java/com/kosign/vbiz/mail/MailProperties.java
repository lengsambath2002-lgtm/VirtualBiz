package com.kosign.vbiz.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code vbiz.mail}: whether emails go out over SMTP ({@code spring.mail.*}) and who they're from.
 * Off, they're only logged (tests, or an environment without a provider yet).
 */
@ConfigurationProperties(prefix = "vbiz.mail")
public record MailProperties(boolean enabled, String from, String appUrl, java.util.List<String> onlyTo) {

    /**
     * Outside production, emails can be limited to some recipients (docs/ops/email.md): each entry
     * is a whole address or a domain ({@code gmail.com}). Empty: everyone.
     */
    public boolean allows(String to) {
        if (onlyTo == null || onlyTo.isEmpty() || to == null) {
            return true;
        }
        String addr = to.trim().toLowerCase(java.util.Locale.ROOT);
        String domain = addr.substring(addr.indexOf('@') + 1);
        return onlyTo.stream().map(x -> x.trim().toLowerCase(java.util.Locale.ROOT))
                .filter(x -> !x.isEmpty()).anyMatch(x -> x.equals(addr) || x.equals(domain));
    }

    public MailProperties {
        if (from == null || from.isBlank()) {
            from = "VirtualBiz <no-reply@virtualbiz.com.kh>";
        }
        if (appUrl == null || appUrl.isBlank()) {
            appUrl = "http://localhost:3000";
        }
    }
}
