package com.kosign.vbiz.admin.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.admin.domain.AdminAudit;
import com.kosign.vbiz.admin.domain.AuditTarget;

public interface AdminAuditRepository extends JpaRepository<AdminAudit, UUID> {

    List<AdminAudit> findTop20ByTargetTypeAndTargetIdOrderByAtDesc(AuditTarget targetType, String targetId);
}
