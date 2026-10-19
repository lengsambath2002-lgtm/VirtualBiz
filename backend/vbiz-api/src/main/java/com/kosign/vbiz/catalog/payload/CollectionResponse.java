package com.kosign.vbiz.catalog.payload;

/** A shop collection; {@code id} is null for a default that has not been used yet. */
public record CollectionResponse(String id, String name, long productCount) {
}
