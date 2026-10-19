package com.kosign.vbiz.auth.service;

import com.kosign.vbiz.auth.domain.OtpPurpose;

/**
 * Delivers a one-time code: by SMS for {@link OtpPurpose#PHONE}, by email otherwise. The
 * production SMS (Twilio-style) and SMTP implementations replace {@link LoggingOtpSender}.
 */
public interface OtpSender {

    /** @param target lower-cased email, or a normalised phone for PHONE */
    void send(OtpPurpose purpose, String target, String code);
}
