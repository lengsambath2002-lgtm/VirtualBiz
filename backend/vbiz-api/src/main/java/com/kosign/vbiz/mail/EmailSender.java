package com.kosign.vbiz.mail;

import java.nio.charset.StandardCharsets;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import jakarta.mail.internet.InternetAddress;

import com.kosign.vbiz.common.logging.LogMask;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Sends an email over SMTP (docs/ops/email.md) once the change that caused it is saved: an invite
 * whose transaction rolls back sends nothing, and a mail server that is down never undoes an
 * invite (the failure is logged; the person can be invited again or use the link the inviter sees).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "vbiz.mail.enabled", havingValue = "true")
public class EmailSender {

    private final JavaMailSender smtp;
    private final MailProperties props;

    public void send(String to, String subject, Email email) {
        Runnable go = () -> deliver(to, subject, email);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    go.run();
                }
            });
        } else {
            go.run();
        }
    }

    private void deliver(String to, String subject, Email email) {
        if (!props.allows(to)) {
            log.info("[MAIL] \"{}\" to {} skipped (vbiz.mail.only-to / never-to)", LogMask.text(subject),
                    LogMask.contact(to));
            return;
        }
        try {
            var message = smtp.createMimeMessage();
            var m = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            m.setFrom(new InternetAddress(props.from()));
            m.setTo(to);
            m.setSubject(subject);
            m.setText(email.text(), email.html());
            smtp.send(message);
            log.info("[MAIL] \"{}\" sent to {}", LogMask.text(subject), LogMask.contact(to));
        } catch (Exception e) {
            log.warn("[MAIL] \"{}\" to {} not sent: {}", LogMask.text(subject), LogMask.contact(to), e.getMessage());
        }
    }
}
