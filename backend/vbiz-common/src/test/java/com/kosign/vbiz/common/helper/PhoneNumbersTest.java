package com.kosign.vbiz.common.helper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

class PhoneNumbersTest {

    @ParameterizedTest(name = "{0} -> {1}")
    @CsvSource(delimiter = '|', value = {
            "012345678        | 012345678",
            "096 818 9261     | 0968189261",
            "012-345-678      | 012345678",
            "(012) 345.678    | 012345678",
            "+85512345678     | 012345678",
            "+855 12 345 678  | 012345678",
            "+855 012 345 678 | 012345678",
            "85596818926      | 096818926",
            "855968189261     | 0968189261",
            "00855 96 818 9261| 0968189261"
    })
    void normalize_strips_separators_and_country_code(String raw, String expected) {
        assertThat(PhoneNumbers.normalize(raw)).isEqualTo(expected);
        assertThat(PhoneNumbers.isValid(expected)).isTrue();
    }

    @Test
    void normalize_returns_null_for_blank() {
        assertThat(PhoneNumbers.normalize(null)).isNull();
        assertThat(PhoneNumbers.normalize("   ")).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"012345678", "0968189261", "010999999"})
    void accepts_valid_numbers(String phone) {
        assertThat(PhoneNumbers.isValid(phone)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "001234567",    // second digit must be 1-9
            "01234567",     // too short (8 digits)
            "01234567890",  // too long (11 digits)
            "12345678",     // no leading 0
            "+85512345678", // not normalized
            "01234567a",
            ""
    })
    void rejects_invalid_numbers(String phone) {
        assertThat(PhoneNumbers.isValid(phone)).isFalse();
    }

    @Test
    void normalizeOrThrow() {
        assertThat(PhoneNumbers.normalizeOrThrow("+855 96 818 9261")).isEqualTo("0968189261");
        assertThatThrownBy(() -> PhoneNumbers.normalizeOrThrow("12345"))
                .isInstanceOf(BusinessException.class)
                .extracting("statusCode").isEqualTo(StatusCode.INVALID_PHONE);
        assertThatThrownBy(() -> PhoneNumbers.normalizeOrThrow(null)).isInstanceOf(BusinessException.class);
    }
}
