package com.kosign.vbiz.account.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.account.domain.Address;

public interface AddressRepository extends JpaRepository<Address, UUID> {

    /** Default first, then oldest first. */
    @Query("select a from Address a where a.userId = :userId order by a.isDefault desc, a.createdAt asc, a.id asc")
    List<Address> findAllForUser(@Param("userId") UUID userId);

    Optional<Address> findByIdAndUserId(UUID id, UUID userId);

    long countByUserId(UUID userId);

    /** Clears the user's default flag; flushes pending changes first so the partial unique index holds. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Address a set a.isDefault = false where a.userId = :userId and a.isDefault = true")
    int clearDefault(@Param("userId") UUID userId);
}
