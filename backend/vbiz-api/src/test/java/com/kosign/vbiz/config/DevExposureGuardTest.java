package com.kosign.vbiz.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import com.kosign.vbiz.admin.service.StaffProperties;
import com.kosign.vbiz.auth.service.AuthProperties;
import com.kosign.vbiz.auth.service.OtpProperties;
import com.kosign.vbiz.business.service.TeamProperties;

/** Codes and invite links never reach a reply outside a developer's machine and the tests. */
class DevExposureGuardTest {

    private static DevExposureGuard guard(String profile, boolean codes, boolean links) {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles(profile);
        StaffProperties staff = new StaffProperties(false, Duration.ofHours(12), Duration.ofDays(7), "x", links, null);
        TeamProperties team = new TeamProperties(Duration.ofDays(7), "x", links);
        return new DevExposureGuard(env, new OtpProperties(codes), staff, team, new AuthProperties(null, null, false));
    }

    @Test
    void a_public_server_refuses_to_start_with_codes_or_links_exposed() {
        assertThatThrownBy(() -> guard("demo", true, false).afterSingletonsInstantiated())
                .hasMessageContaining("vbiz.otp.expose-dev-code");
        assertThatThrownBy(() -> guard("prod", false, true).afterSingletonsInstantiated())
                .hasMessageContaining("vbiz.staff.expose-dev-links")
                .hasMessageContaining("vbiz.team.expose-dev-links");
    }

    @Test
    void a_public_server_with_everything_off_starts() {
        assertThatCode(() -> guard("demo", false, false).afterSingletonsInstantiated()).doesNotThrowAnyException();
    }

    @Test
    void developers_and_tests_may_see_codes() {
        assertThatCode(() -> guard("local", true, true).afterSingletonsInstantiated()).doesNotThrowAnyException();
        assertThatCode(() -> guard("test", true, true).afterSingletonsInstantiated()).doesNotThrowAnyException();
    }
}
