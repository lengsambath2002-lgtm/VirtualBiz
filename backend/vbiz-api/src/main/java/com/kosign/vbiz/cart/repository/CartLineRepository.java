package com.kosign.vbiz.cart.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.kosign.vbiz.cart.domain.CartLine;

public interface CartLineRepository extends JpaRepository<CartLine, UUID> {

    @Query("select l from CartLine l where l.userId = :userId order by l.savedForLater asc, l.position asc, l.id asc")
    List<CartLine> findOfUser(@Param("userId") UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from CartLine l where l.userId = :userId")
    int deleteOfUser(@Param("userId") UUID userId);

    /** Drops the placed variants from the cart (not from "saved for later"). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from CartLine l where l.userId = :userId and l.savedForLater = false and l.variantId in :variantIds")
    int deleteLines(@Param("userId") UUID userId, @Param("variantIds") Collection<UUID> variantIds);
}
