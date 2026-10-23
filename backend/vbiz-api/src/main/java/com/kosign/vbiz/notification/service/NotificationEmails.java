package com.kosign.vbiz.notification.service;

import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.business.domain.Business;
import com.kosign.vbiz.business.repository.BusinessRepository;
import com.kosign.vbiz.mail.Email;
import com.kosign.vbiz.mail.EmailSender;
import com.kosign.vbiz.mail.MailAsyncConfig;
import com.kosign.vbiz.mail.MailProperties;
import com.kosign.vbiz.notification.domain.Notification;
import com.kosign.vbiz.notification.event.NotificationCreated;

import lombok.RequiredArgsConstructor;

/**
 * Every inbox notification also goes out by email (docs/ops/email.md): a customer's to them, a
 * shop's to its owner and managers. Sent once the change is saved, in the background; anyone who
 * turned emails off in My settings is skipped.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "vbiz.mail.enabled", havingValue = "true")
public class NotificationEmails {

    private final EmailSender mail;
    private final MailProperties props;
    private final NotificationRecipients people;
    private final BusinessRepository businesses;

    @Async(MailAsyncConfig.EXECUTOR)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void on(NotificationCreated event) {
        Notification n = event.notification();
        boolean forShop = n.getBusinessId() != null;
        var w = NotificationEmailContent.of(n.getKind(), n.getParams(), forShop);
        if (w == null) {
            return;
        }
        Business shop = forShop ? businesses.findById(n.getBusinessId()).orElse(null) : null;
        String link = props.appUrl() + "/en" + (n.getRoute() == null ? "" : n.getRoute());
        Email e = new Email().preheader(w.line());
        if (shop != null) {
            e.badge(shop.getName(), absolute(shop.getLogoUrl()));
        } else {
            e.badge("VirtualBiz", null);
        }
        e.heading(w.heading()).line(w.line()).buttons(w.button(), link, null, null)
                .divider().heading(w.headingKh()).line(w.lineKh()).buttons(w.buttonKh(), link, null, null)
                .small("You get this because of your VirtualBiz account. Turn these emails off in My settings.");
        for (String to : recipients(n)) {
            mail.send(to, w.subject(), e);
        }
    }

    private Set<String> recipients(Notification n) {
        Set<String> out = new LinkedHashSet<>();
        for (User u : people.of(n)) {
            if (wantsEmail(u)) {
                out.add(u.getEmail());
            }
        }
        return out;
    }

    private static boolean wantsEmail(User u) {
        return u.getEmail() != null && !u.getEmail().isBlank() && u.isPrefEmails() && !u.isSuspended();
    }

    private String absolute(String url) {
        return url != null && url.startsWith("/") ? props.appUrl() + url : url;
    }
}
