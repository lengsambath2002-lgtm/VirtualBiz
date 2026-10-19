package com.kosign.vbiz.meta.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kosign.vbiz.meta.domain.Category;

public interface CategoryRepository extends JpaRepository<Category, String> {
}
