package com.kosign.vbiz.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.kosign.vbiz.auth.service.PasswordPolicy;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

class PasswordPolicyTest {

    private final PasswordPolicy policy = new PasswordPolicy();

    @Test
    void accepts_a_strong_password() {
        assertThat(policy.violations("Demo@1234", "nita@virtualbiz.com")).isEmpty();
    }

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource({
            "Ab1!xyz, len",
            "abcdefg1!, case",
            "ABCDEFG1!, case",
            "Abcdefgh!, num",
            "Abcdefgh1, sym",
            "xNITA@2026yz, email",
    })
    void reports_each_failed_rule(String password, String rule) {
        assertThat(policy.violations(password, "nita@virtualbiz.com")).containsExactly(rule);
    }

    @Test
    void check_throws_validation_failed_with_rules() {
        assertThatThrownBy(() -> policy.check("short", "a@b.co", "password"))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException be = (BusinessException) ex;
                    assertThat(be.getStatusCode()).isEqualTo(StatusCode.VALIDATION_FAILED);
                    assertThat(be.getField()).isEqualTo("password");
                    assertThat(be.getMeta()).containsKey("rules");
                });
    }

    @Test
    void no_email_skips_the_email_rule() {
        assertThat(policy.violations("Demo@1234", null)).isEmpty();
    }
}
