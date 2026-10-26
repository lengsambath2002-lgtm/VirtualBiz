package com.kosign.vbiz.auth.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.auth.domain.OtpPurpose;

import com.kosign.vbiz.common.logging.LogMask;

import lombok.extern.slf4j.Slf4j;

/**
 * Stand-in until an SMS / email gateway is configured: logs that a code was sent. The code
 * itself is logged only when {@code vbiz.otp.expose-dev-code} is on (local / dev). A real
 * gateway sets {@code vbiz.otp.sender} to its own name to switch this one off.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "vbiz.otp.sender", havingValue = "log", matchIfMissing = true)
public class LoggingOtpSender implements OtpSender {

    private final OtpProperties props;

    public LoggingOtpSender(OtpProperties props) {
        this.props = props;
    }

    @Override
    public void send(OtpPurpose purpose, String target, String code) {
        String channel = purpose == OtpPurpose.PHONE ? "SMS" : "email";
        if (props.exposeDevCode()) {
            log.info("[OTP] {} {} code to {}: {}", purpose, channel, LogMask.contact(target), code);
        } else {
            log.warn("[OTP] No {} gateway configured; {} code to {} was not delivered", channel, purpose,
                    LogMask.contact(target));
        }
    }
}
