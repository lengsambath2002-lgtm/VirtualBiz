package com.kosign.vbiz.notification.service;

import java.util.List;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.kosign.vbiz.account.domain.NotifyTopic;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.firebase.FirebaseGateway;
import com.kosign.vbiz.mail.MailAsyncConfig;
import com.kosign.vbiz.mail.MailProperties;
import com.kosign.vbiz.notification.domain.Notification;
import com.kosign.vbiz.notification.event.NotificationCreated;
import com.kosign.vbiz.notification.push.PushToken;
import com.kosign.vbiz.notification.push.PushTokenRepository;

import lombok.RequiredArgsConstructor;

/**
 * Every inbox notification also goes out as a push notification (docs/ops/firebase.md) to the devices
 * its people turned push on for, once the change is saved and in the background. Devices Firebase no
 * longer knows are forgotten.
 */
@Component
@RequiredArgsConstructor
public class NotificationPush {

    private final FirebaseGateway firebase;
    private final NotificationRecipients recipients;
    private final PushTokenRepository tokens;
    private final MailProperties links;

    @Async(MailAsyncConfig.EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void on(NotificationCreated event) {
        if (!firebase.enabled()) {
            return;
        }
        Notification n = event.notification();
        var w = NotificationEmailContent.of(n.getKind(), n.getParams(), n.getBusinessId() != null);
        if (w == null) {
            return;
        }
        NotifyTopic topic = NotificationTopics.of(n);
        List<User> people = recipients.of(n).stream().filter(u -> u.wants(NotifyTopic.Channel.PUSH, topic)).toList();
        if (people.isEmpty()) {
            return;
        }
        List<String> devices = tokens.findByUserIdIn(people.stream().map(User::getId).toList()).stream()
                .map(PushToken::getToken).distinct().toList();
        String link = links.appUrl() + "/en" + (n.getRoute() == null ? "" : n.getRoute());
        List<String> gone = firebase.push(devices, w.subject(), w.line(), link);
        if (!gone.isEmpty()) {
            tokens.deleteByTokens(gone);
        }
    }
}
