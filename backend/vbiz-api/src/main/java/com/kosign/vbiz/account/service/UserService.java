package com.kosign.vbiz.account.service;

import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kosign.vbiz.account.domain.User;
import com.kosign.vbiz.account.repository.UserRepository;
import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;

import lombok.RequiredArgsConstructor;

/** User lookups and writes shared by the auth and account domains. Inputs are already normalised. */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository users;

    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        return email == null ? Optional.empty() : users.findByEmail(email);
    }

    @Transactional(readOnly = true)
    public Optional<User> findByPhone(String phone) {
        return phone == null ? Optional.empty() : users.findByPhone(phone);
    }

    @Transactional(readOnly = true)
    public User require(UUID id) {
        return users.findById(id).orElseThrow(() -> new BusinessException(StatusCode.USER_NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public boolean emailTaken(String email) {
        return email != null && users.existsByEmail(email);
    }

    @Transactional(readOnly = true)
    public boolean phoneTaken(String phone) {
        return phone != null && users.existsByPhone(phone);
    }

    @Transactional
    public User save(User user) {
        return users.saveAndFlush(user);
    }
}
