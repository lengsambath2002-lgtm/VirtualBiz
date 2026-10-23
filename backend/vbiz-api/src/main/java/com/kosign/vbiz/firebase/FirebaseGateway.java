package com.kosign.vbiz.firebase;

import java.util.List;

/**
 * What VirtualBiz asks of Firebase (docs/ops/firebase.md). {@link FirebaseAdminGateway} when a project
 * is configured, else {@link DisabledFirebaseGateway}, which answers {@code NOT_CONFIGURED}.
 */
public interface FirebaseGateway {

    boolean enabled();

    /** Checks an ID token from the web app (signature, project, expiry, revocation). */
    FirebaseIdentity verify(String idToken);

    /**
     * Makes the Firebase account for an email + password VirtualBiz account (or sets its password to
     * this one): its email is already verified by VirtualBiz. Returns the Firebase uid.
     */
    String ensurePasswordUser(String email, String password, String name);

    /** Keeps a Firebase account's password in step with a change made in VirtualBiz. */
    void setPassword(String uid, String password);

    /** Sends a push notification to these device tokens; returns the tokens Firebase no longer knows. */
    List<String> push(List<String> tokens, String title, String body, String link);
}
