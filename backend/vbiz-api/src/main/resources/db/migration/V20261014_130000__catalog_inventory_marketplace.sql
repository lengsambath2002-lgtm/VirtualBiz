-- Phase 2: catalog, inventory, marketplace read models, saved items
-- (docs/api/phase2-catalog-inventory.md). IDs are UUIDs; money is NUMERIC(12,2) USD.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Reference: district centres (distance origin when the customer picks a district) ─────
ALTER TABLE district
    ADD COLUMN lat NUMERIC(9, 6) CHECK (lat BETWEEN -90 AND 90),
    ADD COLUMN lng NUMERIC(9, 6) CHECK (lng BETWEEN -180 AND 180);

UPDATE district SET lat = v.lat, lng = v.lng
FROM (VALUES
    ('toul-kork',     11.583300, 104.899000),
    ('bkk1',          11.552000, 104.924000),
    ('daun-penh',     11.570000, 104.920000),
    ('chamkar-mon',   11.537000, 104.922000),
    ('sen-sok',       11.596000, 104.865000),
    ('russey-keo',    11.625000, 104.905000),
    ('chbar-ampov',   11.532000, 104.955000),
    ('mean-chey',     11.516000, 104.925000),
    ('por-senchey',   11.545000, 104.815000),
    ('prampi-makara', 11.564000, 104.911000)) AS v(id, lat, lng)
WHERE district.id = v.id;

-- ── Business: marketplace display extras ─────────────────────────────────────────────
ALTER TABLE business
    ADD COLUMN reply_minutes INTEGER CHECK (reply_minutes > 0),
    ADD COLUMN eta_min       INTEGER,
    ADD COLUMN eta_max       INTEGER,
    ADD CONSTRAINT ck_business_eta CHECK (
        (eta_min IS NULL AND eta_max IS NULL) OR (eta_min > 0 AND eta_max >= eta_min));

CREATE INDEX ix_business_name_trgm ON business USING gin (name gin_trgm_ops);

-- ── Catalog: collections (shop-defined, open question #11 level 2) ────────────────────
CREATE TABLE collection (
    id           UUID          PRIMARY KEY,
    business_id  UUID          NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    name         VARCHAR(40)   NOT NULL,
    position     INTEGER       NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_collection_name ON collection (business_id, lower(name));

-- ── Catalog: products ───────────────────────────────────────────────────────────────
-- options: [{"name": "Colour", "values": ["Black", …]}] (≤ 3). specs: [{"label", "value"}]
-- (an array keeps the shop's order). photos: URLs (placeholder until the storage domain).
CREATE TABLE product (
    id             UUID           PRIMARY KEY,
    business_id    UUID           NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    slug           VARCHAR(90)    NOT NULL UNIQUE,
    title          VARCHAR(80)    NOT NULL,
    description    VARCHAR(1000)  NOT NULL DEFAULT '',
    category_id    VARCHAR(40)    NOT NULL REFERENCES category (id),
    collection_id  UUID           REFERENCES collection (id) ON DELETE SET NULL,
    status         VARCHAR(10)    NOT NULL CHECK (status IN ('ACTIVE', 'DRAFT')),
    options        JSONB          NOT NULL DEFAULT '[]'::jsonb,
    photos         JSONB          NOT NULL DEFAULT '[]'::jsonb,
    specs          JSONB          NOT NULL DEFAULT '[]'::jsonb,
    low_stock_at   INTEGER        NOT NULL DEFAULT 5 CHECK (low_stock_at >= 0),
    sold_count     INTEGER        NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
    rating         NUMERIC(2, 1)  NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    position       INTEGER        NOT NULL DEFAULT 0,
    deleted_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_product_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
CREATE INDEX ix_product_business ON product (business_id, position) WHERE deleted_at IS NULL;
CREATE INDEX ix_product_title_trgm ON product USING gin (title gin_trgm_ops);
CREATE INDEX ix_product_desc_trgm ON product USING gin (description gin_trgm_ops);

-- option_values: values in product.options order, e.g. ["Black", "128 GB"] ([] = no options).
-- stock is changed only by the inventory stock writer (one movement per change).
CREATE TABLE product_variant (
    id             UUID           PRIMARY KEY,
    product_id     UUID           NOT NULL REFERENCES product (id) ON DELETE CASCADE,
    business_id    UUID           NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    option_values  JSONB          NOT NULL DEFAULT '[]'::jsonb,
    price          NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    compare_at     NUMERIC(12, 2) CHECK (compare_at IS NULL OR compare_at > price),
    cost           NUMERIC(12, 2) CHECK (cost IS NULL OR cost >= 0),
    sku            VARCHAR(40)    NOT NULL DEFAULT '',
    barcode        VARCHAR(40)    NOT NULL,
    stock          INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
    swatch         VARCHAR(9),
    position       INTEGER        NOT NULL DEFAULT 0,
    deleted_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_variant_product ON product_variant (product_id, position) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_variant_barcode ON product_variant (business_id, barcode) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_variant_sku ON product_variant (business_id, lower(sku))
    WHERE deleted_at IS NULL AND sku <> '';

-- Last auto-generated barcode per shop (885000000xxx).
CREATE TABLE catalog_barcode_seq (
    business_id  UUID         PRIMARY KEY REFERENCES business (id) ON DELETE CASCADE,
    last_value   BIGINT       NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Catalog: services ───────────────────────────────────────────────────────────────
CREATE TABLE service (
    id               UUID           PRIMARY KEY,
    business_id      UUID           NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    slug             VARCHAR(90)    NOT NULL UNIQUE,
    name             VARCHAR(80)    NOT NULL,
    category         VARCHAR(40)    NOT NULL,
    description      VARCHAR(500)   NOT NULL DEFAULT '',
    duration_min     INTEGER        NOT NULL CHECK (duration_min BETWEEN 5 AND 600),
    price            NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    discount_pct     SMALLINT       CHECK (discount_pct IS NULL OR discount_pct BETWEEN 1 AND 90),
    bookable_online  BOOLEAN        NOT NULL DEFAULT TRUE,
    sold_count       INTEGER        NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
    rating           NUMERIC(2, 1)  NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
    position         INTEGER        NOT NULL DEFAULT 0,
    deleted_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_service_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
CREATE INDEX ix_service_business ON service (business_id, position) WHERE deleted_at IS NULL;
CREATE INDEX ix_service_name_trgm ON service USING gin (name gin_trgm_ops);
CREATE INDEX ix_service_desc_trgm ON service USING gin (description gin_trgm_ops);

CREATE TABLE service_staff (
    service_id  UUID  NOT NULL REFERENCES service (id) ON DELETE CASCADE,
    member_id   UUID  NOT NULL REFERENCES business_member (id) ON DELETE CASCADE,
    PRIMARY KEY (service_id, member_id)
);
CREATE INDEX ix_service_staff_member ON service_staff (member_id);

-- ── Inventory: the single stock-movement log (online orders, POS, adjustments) ────────
-- by_user_id / by_name null = automatic ("System").
CREATE TABLE stock_movement (
    id           UUID          PRIMARY KEY,
    business_id  UUID          NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    variant_id   UUID          NOT NULL REFERENCES product_variant (id) ON DELETE CASCADE,
    delta        INTEGER       NOT NULL,
    reason       VARCHAR(20)   NOT NULL CHECK (reason IN ('RECEIVED', 'COUNT_CORRECTION', 'DAMAGED_LOST',
                     'CUSTOMER_RETURN', 'ORDER_CANCELLED', 'ORDER_SALE', 'POS_SALE', 'POS_REFUND',
                     'QUICK_ADJUST', 'OPENING_STOCK', 'MARKED_SOLD_OUT')),
    by_user_id   UUID          REFERENCES users (id) ON DELETE SET NULL,
    by_name      VARCHAR(80),
    note         VARCHAR(120),
    at           TIMESTAMPTZ   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_stock_movement_business ON stock_movement (business_id, at DESC);
CREATE INDEX ix_stock_movement_variant ON stock_movement (variant_id, at DESC);

-- ── Promotion: platform codes (business_id null) and shop codes; deals (events feed) ──
CREATE TABLE promotion (
    id            UUID           PRIMARY KEY,
    business_id   UUID           REFERENCES business (id) ON DELETE CASCADE,
    name          VARCHAR(80)    NOT NULL,
    type          VARCHAR(15)    NOT NULL CHECK (type IN ('PERCENT', 'FIXED', 'FREE_SHIPPING')),
    value         NUMERIC(12, 2) NOT NULL CHECK (value >= 0),
    code          VARCHAR(30),
    scope         VARCHAR(10)    NOT NULL CHECK (scope IN ('ALL', 'CATEGORY', 'PRODUCTS')),
    target_ids    JSONB          NOT NULL DEFAULT '[]'::jsonb,
    min_spend     NUMERIC(12, 2) CHECK (min_spend IS NULL OR min_spend >= 0),
    max_discount  NUMERIC(12, 2) CHECK (max_discount IS NULL OR max_discount >= 0),
    starts_at     TIMESTAMPTZ    NOT NULL,
    ends_at       TIMESTAMPTZ    NOT NULL,
    uses          INTEGER        NOT NULL DEFAULT 0,
    usage_limit   INTEGER,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_promotion_dates CHECK (ends_at >= starts_at)
);
CREATE UNIQUE INDEX uq_promotion_platform_code ON promotion (upper(code))
    WHERE business_id IS NULL AND code IS NOT NULL;
CREATE INDEX ix_promotion_business ON promotion (business_id, ends_at);

-- service_ids: JSON array of service ids the deal applies to.
CREATE TABLE deal (
    id            UUID          PRIMARY KEY,
    business_id   UUID          NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    title         VARCHAR(120)  NOT NULL,
    body          VARCHAR(500)  NOT NULL,
    discount_pct  SMALLINT      CHECK (discount_pct IS NULL OR discount_pct BETWEEN 1 AND 100),
    service_ids   JSONB         NOT NULL DEFAULT '[]'::jsonb,
    starts_at     TIMESTAMPTZ   NOT NULL,
    ends_at       TIMESTAMPTZ   NOT NULL,
    views         INTEGER       NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_deal_dates CHECK (ends_at >= starts_at)
);
CREATE INDEX ix_deal_window ON deal (ends_at, starts_at);

-- ── Review (read in Phase 2; written in Phase 5) ─────────────────────────────────────
CREATE TABLE review (
    id            UUID           PRIMARY KEY,
    business_id   UUID           NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    target_type   VARCHAR(10)    NOT NULL CHECK (target_type IN ('PRODUCT', 'SERVICE')),
    target_id     UUID           NOT NULL,
    author_id     UUID           REFERENCES users (id) ON DELETE SET NULL,
    author_name   VARCHAR(80)    NOT NULL,
    stars         SMALLINT       NOT NULL CHECK (stars BETWEEN 1 AND 5),
    text          VARCHAR(1000)  NOT NULL DEFAULT '',
    tags          JSONB          NOT NULL DEFAULT '[]'::jsonb,
    variant_name  VARCHAR(80),
    verified      BOOLEAN        NOT NULL DEFAULT FALSE,
    reply         VARCHAR(1000),
    at            TIMESTAMPTZ    NOT NULL,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_review_target ON review (target_type, target_id, at DESC);
CREATE INDEX ix_review_business ON review (business_id, at DESC);

-- ── Account: saved items and followed shops ─────────────────────────────────────────
CREATE TABLE saved_listing (
    id           UUID          PRIMARY KEY,
    user_id      UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_type  VARCHAR(10)   NOT NULL CHECK (target_type IN ('PRODUCT', 'SERVICE', 'SHOP')),
    target_id    UUID          NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_saved_listing UNIQUE (user_id, target_type, target_id)
);
CREATE INDEX ix_saved_listing_user ON saved_listing (user_id, created_at DESC);

-- ── Marketplace read model: one row per listed product / service ────────────────────
-- net_price: what the customer pays for the default variant (products: the first variant
-- in matrix order; services: price less the discount). on_sale: a discount applies.
CREATE VIEW marketplace_listing AS
SELECT 'PRODUCT'::varchar(10)          AS kind,
       p.id, p.slug, p.business_id, p.title AS name, p.description,
       p.sold_count, p.rating, p.position,
       v.price                         AS net_price,
       (v.compare_at IS NOT NULL AND v.compare_at > v.price) AS on_sale
FROM product p
JOIN LATERAL (
    SELECT pv.price, pv.compare_at FROM product_variant pv
    WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
    ORDER BY pv.position, pv.id LIMIT 1) v ON TRUE
WHERE p.deleted_at IS NULL AND p.status = 'ACTIVE'
UNION ALL
SELECT 'SERVICE'::varchar(10),
       s.id, s.slug, s.business_id, s.name, s.description,
       s.sold_count, s.rating, s.position,
       round(s.price * (100 - coalesce(s.discount_pct, 0)) / 100, 2),
       coalesce(s.discount_pct, 0) > 0
FROM service s
WHERE s.deleted_at IS NULL AND s.bookable_online;
