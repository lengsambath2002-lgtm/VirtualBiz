package com.kosign.vbiz.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.admin.service.AuditLog;
import com.kosign.vbiz.admin.service.StaffBootstrap;
import com.kosign.vbiz.admin.service.StaffProperties;
import com.kosign.vbiz.auth.service.PasswordPolicy;

class StaffBootstrapTest {

    private final UserRepository users = mock(UserRepository.class);
    private final AuditLog audit = mock(AuditLog.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);

    private StaffBootstrap bootstrap(String email, String password) {
        StaffProperties props = new StaffProperties(true, Duration.ofHours(12), Duration.ofDays(7), "http://x", false,
                new StaffProperties.Bootstrap(email, "Owner Name", password));
        return new StaffBootstrap(props, users, new PasswordPolicy(), encoder, audit);
    }

    @Test
    void creates_the_first_super_admin_who_must_change_the_password() {
        when(users.countByPlatformRoleAndSuspendedAtIsNull(PlatformRole.SUPER_ADMIN)).thenReturn(0L);
        when(users.findByEmail("owner@company.kh")).thenReturn(Optional.empty());
        when(users.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        bootstrap(" Owner@Company.kh ", "Launch#Day2026!").run(null);
        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).saveAndFlush(saved.capture());
        User u = saved.getValue();
        assertThat(u.getEmail()).isEqualTo("owner@company.kh");
        assertThat(u.getPlatformRole()).isEqualTo(PlatformRole.SUPER_ADMIN);
        assertThat(u.isMustChangePassword()).isTrue();
        assertThat(encoder.matches("Launch#Day2026!", u.getPasswordHash())).isTrue();
        verify(audit).record(any(), eq(AuditLog.STAFF_BOOTSTRAPPED), any(), any(), any(), any(), any());
    }

    @Test
    void refuses_a_weak_bootstrap_password() {
        when(users.countByPlatformRoleAndSuspendedAtIsNull(PlatformRole.SUPER_ADMIN)).thenReturn(0L);
        assertThatThrownBy(() -> bootstrap("owner@company.kh", "Short#1a").run(null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("12+");
    }

    @Test
    void does_nothing_once_a_super_admin_exists_or_without_settings() {
        when(users.countByPlatformRoleAndSuspendedAtIsNull(PlatformRole.SUPER_ADMIN)).thenReturn(1L);
        bootstrap("owner@company.kh", "Launch#Day2026!").run(null);
        when(users.countByPlatformRoleAndSuspendedAtIsNull(PlatformRole.SUPER_ADMIN)).thenReturn(0L);
        bootstrap("", null).run(null);
        verify(users, never()).saveAndFlush(any());
    }
}
