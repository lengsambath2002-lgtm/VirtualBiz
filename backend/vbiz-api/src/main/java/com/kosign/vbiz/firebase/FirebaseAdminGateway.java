package com.kosign.vbiz.firebase;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.auth.UserRecord;
import com.google.firebase.messaging.BatchResponse;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.MulticastMessage;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.WebpushConfig;
import com.google.firebase.messaging.WebpushFcmOptions;
import com.google.firebase.messaging.WebpushNotification;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.logging.LogMask;

import lombok.extern.slf4j.Slf4j;

/** Firebase through the Admin SDK (a service account), for a configured project. */
@Slf4j
public class FirebaseAdminGateway implements FirebaseGateway {

    private static final String ICON = "/brand/icon-192.png";

    private final FirebaseAuth auth;
    private final FirebaseMessaging messaging;

    public FirebaseAdminGateway(FirebaseApp app) {
        this.auth = FirebaseAuth.getInstance(app);
        this.messaging = FirebaseMessaging.getInstance(app);
    }

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public FirebaseIdentity verify(String idToken) {
        try {
            FirebaseToken t = auth.verifyIdToken(idToken, true);
            Object fb = t.getClaims().get("firebase");
            String provider = fb instanceof Map<?, ?> m && m.get("sign_in_provider") != null
                    ? m.get("sign_in_provider").toString() : "";
            return new FirebaseIdentity(t.getUid(), t.getEmail(), t.isEmailVerified(), t.getName(), t.getPicture(),
                    provider);
        } catch (FirebaseAuthException | IllegalArgumentException e) {
            throw new BusinessException(StatusCode.INVALID_TOKEN);
        }
    }

    @Override
    public String ensurePasswordUser(String email, String password, String name) {
        try {
            UserRecord existing = auth.getUserByEmail(email);
            auth.updateUser(new UserRecord.UpdateRequest(existing.getUid()).setPassword(password).setEmailVerified(true));
            return existing.getUid();
        } catch (FirebaseAuthException e) {
            if (e.getAuthErrorCode() != AuthErrorCode.USER_NOT_FOUND) {
                throw new BusinessException(StatusCode.NOT_CONFIGURED);
            }
        }
        try {
            return auth.createUser(new UserRecord.CreateRequest().setEmail(email).setPassword(password)
                    .setEmailVerified(true).setDisplayName(name)).getUid();
        } catch (FirebaseAuthException e) {
            log.warn("[FIREBASE] Could not create the account for {}: {}", LogMask.contact(email), e.getMessage());
            throw new BusinessException(StatusCode.NOT_CONFIGURED);
        }
    }

    @Override
    public void setPassword(String uid, String password) {
        try {
            auth.updateUser(new UserRecord.UpdateRequest(uid).setPassword(password));
        } catch (FirebaseAuthException e) {
            log.warn("[FIREBASE] Password not synced for {}: {}", uid, e.getMessage());
        }
    }

    @Override
    public List<String> push(List<String> tokens, String title, String body, String link) {
        if (tokens.isEmpty()) {
            return List.of();
        }
        // Firebase opens an https link itself; a local http one is opened by our service worker
        // (public/firebase-messaging-sw.js) from the data.
        // The browser shows the app icon the web app serves (public/brand) beside the text.
        URI site = URI.create(link);
        WebpushConfig.Builder web = WebpushConfig.builder().setNotification(
                new WebpushNotification(title, body, site.getScheme() + "://" + site.getAuthority() + ICON));
        if (link.startsWith("https://")) {
            web.setFcmOptions(WebpushFcmOptions.withLink(link));
        }
        MulticastMessage msg = MulticastMessage.builder()
                .addAllTokens(tokens)
                .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                .putData("link", link)
                .setWebpushConfig(web.build())
                .build();
        List<String> gone = new ArrayList<>();
        try {
            BatchResponse r = messaging.sendEachForMulticast(msg);
            for (int i = 0; i < r.getResponses().size(); i++) {
                var one = r.getResponses().get(i);
                if (!one.isSuccessful() && one.getException() != null
                        && (one.getException().getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED
                                || one.getException().getMessagingErrorCode() == MessagingErrorCode.SENDER_ID_MISMATCH)) {
                    gone.add(tokens.get(i));
                }
            }
            log.info("[PUSH] \"{}\" to {} device(s): {} sent", title, tokens.size(), r.getSuccessCount());
        } catch (Exception e) {
            log.warn("[PUSH] \"{}\" not sent: {}", title, e.getMessage());
        }
        return gone;
    }
}
