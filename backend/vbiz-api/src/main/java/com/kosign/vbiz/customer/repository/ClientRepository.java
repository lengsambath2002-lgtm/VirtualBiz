package com.kosign.vbiz.customer.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.customer.domain.Client;

public interface ClientRepository extends JpaRepository<Client, UUID> {

    List<Client> findByBusinessIdOrderByNameAscIdAsc(UUID businessId);

    Optional<Client> findByIdAndBusinessId(UUID id, UUID businessId);

    Optional<Client> findByBusinessIdAndPhone(UUID businessId, String phone);

    Optional<Client> findByBusinessIdAndUserId(UUID businessId, UUID userId);

    List<Client> findByIdIn(Collection<UUID> ids);

    /** A shop's customers with an email whose email starts with, or name contains, the text typed. */
    @Query("""
            select c from Client c
             where c.businessId = :businessId and c.email is not null and c.email <> ''
               and (lower(c.email) like :emailPrefix escape '\\' or lower(c.name) like :nameLike escape '\\')
             order by c.name, c.id
            """)
    List<Client> suggestByEmail(@Param("businessId") UUID businessId, @Param("emailPrefix") String emailPrefix,
            @Param("nameLike") String nameLike, Pageable page);
}
