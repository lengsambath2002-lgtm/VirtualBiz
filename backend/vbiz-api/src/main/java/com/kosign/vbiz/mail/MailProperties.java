package com.kosign.vbiz.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code vbiz.mail}: whether emails go out over SMTP ({@code spring.mail.*}) and who they're from.
 * Off, they're only logged (tests, or an environment without a provider yet).
 */
@ConfigurationProperties(prefix = "vbiz.mail")
public record MailProperties(boolean enabled, String from, String appUrl, java.util.List<String> onlyTo,
        java.util.List<String> neverTo) {

    /**
     * Who may be emailed (docs/ops/email.md). Each entry is a whole address or a domain
     * ({@code gmail.com}). {@code onlyTo}: outside production, only these (empty: everyone).
     * {@code neverTo}: never these, e.g. the public demo's made-up accounts, which belong to nobody
     * (or to a stranger).
     */
    public boolean allows(String to) {
        if (to == null) {
            return true;
        }
        String addr = to.trim().toLowerCase(java.util.Locale.ROOT);
        if (matches(neverTo, addr)) {
            return false;
        }
        return onlyTo == null || onlyTo.stream().allMatch(x -> x.isBlank()) || matches(onlyTo, addr);
    }

    private static boolean matches(java.util.List<String> list, String addr) {
        if (list == null) {
            return false;
        }
        String domain = addr.substring(addr.indexOf('@') + 1);
        return list.stream().map(x -> x.trim().toLowerCase(java.util.Locale.ROOT))
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
