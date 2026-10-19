package com.kosign.vbiz.account.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.account.domain.User;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** {@code email} must already be lower-cased. */
    Optional<User> findByEmail(String email);

    /** {@code phone} must already be normalised. */
    Optional<User> findByPhone(String phone);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);
}
