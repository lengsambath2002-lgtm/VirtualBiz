package com.kosign.vbiz.mail;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code vbiz.mail}: whether emails go out over SMTP ({@code spring.mail.*}) and who they're from.
 * Off, they're only logged (tests, or an environment without a provider yet).
 */
@ConfigurationProperties(prefix = "vbiz.mail")
public record MailProperties(boolean enabled, String from) {

    public MailProperties {
        if (from == null || from.isBlank()) {
            from = "VirtualBiz <no-reply@virtualbiz.com.kh>";
        }
    }
}
