package com.kosign.vbiz.platform.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.platform.domain.IdentityProvider;
import com.kosign.vbiz.platform.domain.UserIdentity;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {

    Optional<UserIdentity> findByProviderAndSubject(IdentityProvider provider, String subject);

    Optional<UserIdentity> findByUserIdAndProvider(UUID userId, IdentityProvider provider);
}
