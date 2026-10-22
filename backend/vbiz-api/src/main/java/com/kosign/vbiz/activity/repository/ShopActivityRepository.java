package com.kosign.vbiz.activity.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.kosign.vbiz.activity.domain.ShopActivity;

public interface ShopActivityRepository extends JpaRepository<ShopActivity, UUID>,
        JpaSpecificationExecutor<ShopActivity> {
}
