package com.kosign.vbiz.business;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kosign.vbiz.business.service.BusinessRules;
import com.kosign.vbiz.common.error.BusinessException;

class BusinessRulesTest {

    @Test
    void slugify_matches_the_prototype() {
        assertThat(BusinessRules.slugify("Nita Gadget Store")).isEqualTo("nita-gadget-store");
        assertThat(BusinessRules.slugify("  Café & Food!! ")).isEqualTo("cafe-food");
        assertThat(BusinessRules.slugify("ហាង")).isEqualTo("shop");
    }

    @Test
    void week_from_form_closes_sunday_unless_asked() {
        List<List<Integer>> week = BusinessRules.weekFromForm("08:00", "18:30", false);
        assertThat(week).hasSize(7);
        assertThat(week.get(0)).containsExactly(480, 1110);
        assertThat(week.get(6)).isNull();
        assertThat(BusinessRules.weekFromForm("08:00", "18:00", true).get(6)).containsExactly(480, 1080);
        assertThatThrownBy(() -> BusinessRules.weekFromForm("18:00", "08:00", false)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> BusinessRules.weekFromForm("8am", "18:00", false)).isInstanceOf(BusinessException.class);
    }

    @Test
    void week_from_json_accepts_seven_ranges() throws Exception {
        ObjectMapper om = new ObjectMapper();
        List<List<Integer>> week = BusinessRules.weekFromJson(
                om.readTree("[[540,1200],null,[540,1200],[540,1200],[540,1200],[540,1200],[600,1080]]"));
        assertThat(week.get(1)).isNull();
        assertThat(week.get(6)).isEqualTo(Arrays.asList(600, 1080));
        assertThatThrownBy(() -> BusinessRules.weekFromJson(om.readTree("[[1,2]]"))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> BusinessRules.weekFromJson(
                om.readTree("[[600,500],null,null,null,null,null,null]"))).isInstanceOf(BusinessException.class);
    }

    @Test
    void bakong_id_and_id_photo() {
        assertThat(BusinessRules.bakongId(" so.ni_ta-1@ABA ")).isEqualTo("so.ni_ta-1@ABA");
        assertThatThrownBy(() -> BusinessRules.bakongId("sonita@aba1")).isInstanceOf(BusinessException.class);
        BusinessRules.DataUrl d = BusinessRules.decodeIdPhoto("data:image/jpg;base64,AQID");
        assertThat(d.contentType()).isEqualTo("image/jpeg");
        assertThat(d.bytes()).containsExactly(1, 2, 3);
        assertThatThrownBy(() -> BusinessRules.decodeIdPhoto("data:text/html;base64,AQID")).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> BusinessRules.decodeIdPhoto("hello")).isInstanceOf(BusinessException.class);
    }
}
