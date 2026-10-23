package com.kosign.vbiz.mail;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Emails go out on a small pool of their own (docs/ops/email.md): an SMTP server taking a second or
 * two never holds up the request that caused the email.
 */
@Configuration
@EnableAsync
public class MailAsyncConfig {

    public static final String EXECUTOR = "mailExecutor";

    @Bean(name = EXECUTOR)
    public Executor mailExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setThreadNamePrefix("mail-");
        ex.setCorePoolSize(2);
        ex.setMaxPoolSize(4);
        ex.setQueueCapacity(500);
        ex.initialize();
        return ex;
    }
}
