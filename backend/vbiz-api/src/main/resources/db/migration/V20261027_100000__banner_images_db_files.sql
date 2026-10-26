-- Homepage banners get a background image (docs/api/site-content.md), uploaded as SITE_BANNER.
ALTER TABLE stored_file DROP CONSTRAINT stored_file_purpose_check;
ALTER TABLE stored_file ADD CONSTRAINT stored_file_purpose_check CHECK (purpose IN ('AVATAR', 'USER_COVER',
    'BUSINESS_LOGO', 'BUSINESS_COVER', 'PRODUCT_PHOTO', 'SITE_BANNER'));

-- Uploaded bytes kept in the database (vbiz.storage.type=db), for hosts whose disk is wiped on
-- every restart (Render's free plan). Keyed like the files on disk: stored_file.storage_key.
CREATE TABLE file_blob (
    storage_key   VARCHAR(200)  PRIMARY KEY,
    bytes         BYTEA         NOT NULL,
    content_type  VARCHAR(40)   NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
