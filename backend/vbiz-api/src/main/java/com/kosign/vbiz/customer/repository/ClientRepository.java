package com.kosign.vbiz.customer.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.customer.domain.Client;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    List<Client> findByBusinessIdOrderByNameAscIdAsc(UUID businessId);

    Optional<Client> findByIdAndBusinessId(UUID id, UUID businessId);

    Optional<Client> findByBusinessIdAndPhone(UUID businessId, String phone);

    Optional<Client> findByBusinessIdAndUserId(UUID businessId, UUID userId);

    List<Client> findByIdIn(Collection<UUID> ids);
}
