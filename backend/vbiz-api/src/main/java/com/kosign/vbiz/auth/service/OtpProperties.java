package com.kosign.vbiz.auth.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * {@code vbiz.otp.*}. {@code exposeDevCode} returns the code as {@code data.devCode} (local and
 * dev only, while no SMS / email gateway exists). Never true in uat or prod.
 */
@ConfigurationProperties(prefix = "vbiz.otp")
public record OtpProperties(boolean exposeDevCode) {
}
