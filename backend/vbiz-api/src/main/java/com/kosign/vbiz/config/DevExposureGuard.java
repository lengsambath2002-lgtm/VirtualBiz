package com.kosign.vbiz.config;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import com.kosign.vbiz.admin.service.StaffProperties;
import com.kosign.vbiz.auth.service.AuthProperties;
import com.kosign.vbiz.auth.service.OtpProperties;
import com.kosign.vbiz.business.service.TeamProperties;

import lombok.RequiredArgsConstructor;

/**
 * The testing aids that hand out secrets (sign-in codes in API replies, invite links on screen,
 * the fake Google chooser) belong on a developer's machine and in the tests only. Anywhere else
 * (a public demo, production) the API refuses to start with any of them on, so a copied config
 * can't open every account to anyone.
 */
@Component
@RequiredArgsConstructor
public class DevExposureGuard implements SmartInitializingSingleton {

    /** Profiles that may show codes and links: a developer's machine and the tests. */
    static final Set<String> TESTING = Set.of("local", "dev", "test");

    private final Environment env;
    private final OtpProperties otp;
    private final StaffProperties staff;
    private final TeamProperties team;
    private final AuthProperties auth;

    @Override
    public void afterSingletonsInstantiated() {
        if (Arrays.stream(env.getActiveProfiles()).anyMatch(TESTING::contains)) {
            return;
        }
        List<String> on = new ArrayList<>();
        if (otp.exposeDevCode()) {
            on.add("vbiz.otp.expose-dev-code");
        }
        if (staff.exposeDevLinks()) {
            on.add("vbiz.staff.expose-dev-links");
        }
        if (team.exposeDevLinks()) {
            on.add("vbiz.team.expose-dev-links");
        }
        if (Boolean.TRUE.equals(auth.googleDevEnabled())) {
            on.add("vbiz.auth.google-dev-enabled");
        }
        if (!on.isEmpty()) {
            throw new IllegalStateException("Testing aids that expose sign-in codes or links are on outside "
                    + TESTING + " profiles " + Arrays.toString(env.getActiveProfiles()) + ": " + on
                    + ". Turn them off (docs/ops/security.md).");
        }
    }
}
