-- Reference data owned by the meta domain: districts and platform categories.
-- Times are TIMESTAMPTZ (UTC). IDs are stable slugs so clients can key translations on them.

-- ── District ─────────────────────────────────────────────────────────────────────────
-- Open question #10: one table, seeded with Create Business's 10 districts (same order).
-- km = approximate road distance from the city centre (Wat Phnom / Daun Penh), used only to
-- sort by distance. The prototypes carry no km values; these are estimates to be confirmed.
CREATE TABLE district (
    id          VARCHAR(40)   PRIMARY KEY,
    name        VARCHAR(80)   NOT NULL UNIQUE,
    km          NUMERIC(4, 1) NOT NULL CHECK (km >= 0),
    sort_order  INTEGER       NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

INSERT INTO district (id, name, km, sort_order) VALUES
    ('toul-kork',     'Toul Kork',      4.0,  10),
    ('bkk1',          'BKK1',           2.5,  20),
    ('daun-penh',     'Daun Penh',      0.5,  30),
    ('chamkar-mon',   'Chamkar Mon',    3.5,  40),
    ('sen-sok',       'Sen Sok',        9.0,  50),
    ('russey-keo',    'Russey Keo',     7.0,  60),
    ('chbar-ampov',   'Chbar Ampov',    6.0,  70),
    ('mean-chey',     'Mean Chey',      7.5,  80),
    ('por-senchey',   'Por Senchey',   14.0,  90),
    ('prampi-makara', 'Prampi Makara',  2.0, 100);

-- ── Category ─────────────────────────────────────────────────────────────────────────
-- Open question #11: platform categories (this table) vs shop-defined collections (later,
-- per business). Seed = the marketplace bar (Customer / Landing CATS: name, icon, tint) plus
-- the extra Create Business choices. Onboarding labels map onto the marketplace rows:
--   Café & food → cafe, Phones & electronics → electronics, Salon & barber → salon,
--   Spa & massage → spa, Nails → beauty.
-- Onboarding-only rows (beauty-products, fitness, other-*) have in_marketplace = false.
CREATE TABLE category (
    id              VARCHAR(40)  PRIMARY KEY,
    name            VARCHAR(80)  NOT NULL,
    icon            VARCHAR(40)  NOT NULL,
    tint            SMALLINT     NOT NULL CHECK (tint BETWEEN 1 AND 6),
    business_type   VARCHAR(20)  NOT NULL CHECK (business_type IN ('PRODUCT', 'SERVICE')),
    in_marketplace  BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order      INTEGER      NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_category_type_name UNIQUE (business_type, name)
);

INSERT INTO category (id, name, icon, tint, business_type, in_marketplace, sort_order) VALUES
    ('cafe',            'Café',            'cup',      1, 'PRODUCT', TRUE,   10),
    ('electronics',     'Electronics',     'phone',    2, 'PRODUCT', TRUE,   20),
    ('fashion',         'Fashion',         'shirt',    4, 'PRODUCT', TRUE,   30),
    ('grocery',         'Grocery',         'basket',   3, 'PRODUCT', TRUE,   40),
    ('spa',             'Spa',             'leaf',     3, 'SERVICE', TRUE,   50),
    ('beauty',          'Beauty',          'brush',    5, 'SERVICE', TRUE,   60),
    ('salon',           'Salon',           'scissors', 6, 'SERVICE', TRUE,   70),
    ('repair',          'Repair',          'wrench',   2, 'SERVICE', TRUE,   80),
    ('beauty-products', 'Beauty products', 'brush',    5, 'PRODUCT', FALSE,  90),
    ('fitness',         'Fitness',         'dumbbell', 4, 'SERVICE', FALSE, 100),
    ('other-product',   'Other',           'grid',     6, 'PRODUCT', FALSE, 900),
    ('other-service',   'Other',           'grid',     6, 'SERVICE', FALSE, 910);

CREATE INDEX ix_category_type_sort ON category (business_type, sort_order);
