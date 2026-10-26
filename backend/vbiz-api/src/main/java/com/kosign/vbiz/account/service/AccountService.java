package com.kosign.vbiz.account.service;

import java.util.Set;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.NotifyTopic;
import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.mapper.AccountMapper;
import com.kosign.vbiz.account.payload.ChangePasswordRequest;
import com.kosign.vbiz.account.payload.MeResponse;
import com.kosign.vbiz.account.payload.PrefsDto;
import com.kosign.vbiz.firebase.FirebaseGateway;
import com.kosign.vbiz.account.payload.UpdateMeRequest;
import com.kosign.vbiz.account.payload.UserResponse;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.auth.domain.SignInMethod;
import com.kosign.vbiz.auth.service.PasswordPolicy;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.common.helper.PhoneNumbers;

import com.kosign.vbiz.storage.domain.FilePurpose;
import com.kosign.vbiz.storage.service.StorageService;

import lombok.RequiredArgsConstructor;

/** The signed-in user's own profile, preferences and password. */
@Service
@RequiredArgsConstructor
public class AccountService {

    private final UserRepository users;
    private final StorageService storage;
    private final PasswordPolicy passwordPolicy;
    private final PasswordEncoder passwordEncoder;
    private final FirebaseGateway firebase;

    @Transactional(readOnly = true)
    public MeResponse me(UUID userId) {
        return AccountMapper.toMe(require(userId));
    }

    @Transactional
    public UserResponse update(UUID userId, UpdateMeRequest req) {
        User user = require(userId);
        if (req.name() != null) {
            String name = req.name().trim();
            if (name.isEmpty()) {
                throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "name", "Name is required");
            }
            user.setName(name);
        }
        if (req.phone() != null) {
            if (req.phone().isBlank()) {
                if (user.getEmail() == null) {
                    throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "phone",
                            "An account without an email must keep its phone");
                }
                user.setPhone(null);
            } else {
                String phone = PhoneNumbers.normalizeOrThrow(req.phone());
                if (!phone.equals(user.getPhone()) && users.existsByPhone(phone)) {
                    throw BusinessException.withDetail(StatusCode.CONFLICT, "phone", "Phone number already in use");
                }
                user.setPhone(phone);
            }
        }
        if (req.avatarUrl() != null) {
            user.setAvatarUrl(storage.requireOwnImage(req.avatarUrl(), userId, "avatarUrl", Set.of(FilePurpose.AVATAR)));
        }
        if (req.coverUrl() != null) {
            user.setCoverUrl(storage.requireOwnImage(req.coverUrl(), userId, "coverUrl", Set.of(FilePurpose.USER_COVER)));
        }
        return AccountMapper.toUser(users.saveAndFlush(user));
    }

    @Transactional
    public PrefsDto updatePrefs(UUID userId, PrefsDto prefs) {
        User user = require(userId);
        user.setPrefDeals(prefs.deals());
        user.setPrefPromos(prefs.promos());
        if (prefs.topics() != null) {
            prefs.topics().forEach((topic, ch) -> {
                if (topic != null && ch != null) {
                    user.setWants(NotifyTopic.Channel.EMAIL, topic, ch.email());
                    user.setWants(NotifyTopic.Channel.PUSH, topic, ch.push());
                }
            });
        }
        return AccountMapper.toPrefs(user);
    }

    /**
     * Changes the password after checking the current one. An account without a password yet
     * (Google or phone sign-up) sets its first one and gains the PASSWORD method.
     */
    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = require(userId);
        if (user.hasPassword() && (req.currentPassword() == null
                || !passwordEncoder.matches(req.currentPassword(), user.getPasswordHash()))) {
            throw BusinessException.withDetail(StatusCode.INVALID_CREDENTIALS, "currentPassword",
                    "Current password is incorrect");
        }
        passwordPolicy.check(req.newPassword(), user.getEmail(), "newPassword", user.isStaff());
        if (user.hasPassword() && passwordEncoder.matches(req.newPassword(), user.getPasswordHash())) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "newPassword",
                    "Password was used before");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setMustChangePassword(false);
        user.addSignInMethod(SignInMethod.PASSWORD);
        if (user.getFirebaseUid() != null) {
            firebase.setPassword(user.getFirebaseUid(), req.newPassword());
        }
    }

    private User require(UUID userId) {
        return users.findById(userId).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
    }
}
