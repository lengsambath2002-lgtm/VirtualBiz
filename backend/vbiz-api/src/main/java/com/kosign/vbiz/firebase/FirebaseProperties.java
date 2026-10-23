package com.kosign.vbiz.firebase;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code vbiz.firebase} (docs/ops/firebase.md): Firebase Authentication (Google and email + password
 * sign-in) and Cloud Messaging (push). Off until a project is configured: sign-in then uses
 * VirtualBiz's own flows and no push is sent.
 *
 * @param credentials path to the service-account JSON (Project settings → Service accounts)
 * @param projectId   the Firebase project id (e.g. {@code virtaulbiz})
 */
@ConfigurationProperties(prefix = "vbiz.firebase")
public record FirebaseProperties(boolean enabled, String credentials, String projectId) {
}
