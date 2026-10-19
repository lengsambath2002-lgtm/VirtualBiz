package com.kosign.vbiz.storage.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.storage.domain.StoredFile;

public interface StoredFileRepository extends JpaRepository<StoredFile, UUID> {
}
