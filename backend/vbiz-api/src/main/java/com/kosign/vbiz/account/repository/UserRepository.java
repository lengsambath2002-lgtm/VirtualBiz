package com.kosign.vbiz.account.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.kosign.vbiz.account.domain.PlatformRole;
import com.kosign.vbiz.account.domain.User;

import jakarta.persistence.LockModeType;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** {@code email} must already be lower-cased. */
    Optional<User> findByEmail(String email);

    /** {@code phone} must already be normalised. */
    Optional<User> findByPhone(String phone);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    /** Active (not suspended) accounts with this staff role. */
    long countByPlatformRoleAndSuspendedAtIsNull(PlatformRole role);

    /** The row, locked until the transaction ends (concurrent two-step set-up). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.id = :id")
    Optional<User> findByIdForUpdate(UUID id);

    /** Every staff account, by name. */
    List<User> findByPlatformRoleIsNotNullOrderByNameAsc();
}
