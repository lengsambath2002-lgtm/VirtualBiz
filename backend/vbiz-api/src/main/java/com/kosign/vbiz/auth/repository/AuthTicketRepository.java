package com.kosign.vbiz.auth.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.auth.domain.AuthTicket;

public interface AuthTicketRepository extends JpaRepository<AuthTicket, UUID> {

    Optional<AuthTicket> findByTokenHash(String tokenHash);
}
