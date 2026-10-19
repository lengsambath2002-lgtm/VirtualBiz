-- Uploaded images (profile and cover photos, product photos) and optional payout details
-- (docs/api/phase6-files-profiles.md).

-- Files are stored by the storage backend under `storage_key`; this row is what the API knows.
CREATE TABLE stored_file (
    id            UUID          PRIMARY KEY,
    owner_id      UUID          REFERENCES users (id) ON DELETE SET NULL,
    purpose       VARCHAR(20)   NOT NULL CHECK (purpose IN ('AVATAR', 'USER_COVER', 'BUSINESS_LOGO',
                      'BUSINESS_COVER', 'PRODUCT_PHOTO')),
    content_type  VARCHAR(40)   NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    size_bytes    INTEGER       NOT NULL CHECK (size_bytes > 0),
    storage_key   VARCHAR(200)  NOT NULL UNIQUE,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_stored_file_owner ON stored_file (owner_id, created_at DESC);

-- Users get a cover photo next to the avatar.
ALTER TABLE users ADD COLUMN cover_url VARCHAR(500);

-- "Get paid" is optional when creating a business: the Bakong ID can come later (payouts start
-- once it is set and the ID is verified).
ALTER TABLE business ALTER COLUMN bakong_id DROP NOT NULL;
