package com.kosign.vbiz.auth.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

import com.kosign.vbiz.auth.domain.AuthTicket;

public interface AuthTicketRepository extends JpaRepository<AuthTicket, UUID> {

    Optional<AuthTicket> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM AuthTicket t WHERE t.tokenHash = :tokenHash")
    Optional<AuthTicket> findByTokenHashForUpdate(String tokenHash);
}
