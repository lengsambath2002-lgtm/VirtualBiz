-- Phase 5: Seller POS, promotions, reviews, the Seller's customer list
-- (docs/api/phase5-pos-promotions-reviews.md).

-- ── Clients for product shops too: the accounts that ordered (district from the address) ──
ALTER TABLE client ADD COLUMN district VARCHAR(80);

INSERT INTO client (id, business_id, user_id, name, phone, email, district, since)
SELECT gen_random_uuid(), x.business_id, x.customer_id, x.name, x.phone, x.email, x.district, x.since
FROM (
    SELECT DISTINCT ON (o.business_id, o.customer_id)
           o.business_id, o.customer_id, u.name, COALESCE(u.phone, o.address ->> 'phone') AS phone, u.email,
           o.address ->> 'district' AS district,
           MIN(COALESCE(o.placed_at, o.created_at)) OVER (PARTITION BY o.business_id, o.customer_id) AS since
    FROM orders o
    JOIN users u ON u.id = o.customer_id
    ORDER BY o.business_id, o.customer_id, o.created_at DESC
) x
WHERE x.phone ~ '^0[1-9][0-9]{7,8}$'
ON CONFLICT DO NOTHING;

-- ── Counter sales: R- receipts in the Phase 4 sale tables ─────────────────────────────
CREATE SEQUENCE receipt_number_seq START WITH 1 MINVALUE 1;

ALTER TABLE sale DROP CONSTRAINT ck_sale_number;
ALTER TABLE sale ADD CONSTRAINT ck_sale_number CHECK (number ~ '^(S|R)-[0-9]{5,}$');
ALTER TABLE sale ADD COLUMN customer_name VARCHAR(80);
ALTER TABLE sale ADD COLUMN discount_reason VARCHAR(20);
-- The register's own id for a sale, so one queued offline and sent twice is stored once.
ALTER TABLE sale ADD COLUMN client_ref UUID;
CREATE UNIQUE INDEX uq_sale_client_ref ON sale (business_id, client_ref) WHERE client_ref IS NOT NULL;

ALTER TABLE sale_line ADD COLUMN product_id UUID REFERENCES product (id) ON DELETE SET NULL;
ALTER TABLE sale_line ADD COLUMN variant_name VARCHAR(80);
ALTER TABLE sale_line DROP CONSTRAINT sale_line_qty_check;
ALTER TABLE sale_line ADD CONSTRAINT sale_line_qty_check CHECK (qty BETWEEN 1 AND 999);

-- ── Shifts and the cash drawer ─────────────────────────────────────────────────────────
CREATE TABLE pos_shift (
    id              UUID           PRIMARY KEY,
    business_id     UUID           NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    opened_by       UUID           REFERENCES users (id) ON DELETE SET NULL,
    opened_by_name  VARCHAR(80)    NOT NULL,
    opened_at       TIMESTAMPTZ    NOT NULL,
    float_usd       NUMERIC(12, 2) NOT NULL CHECK (float_usd >= 0),
    float_khr       BIGINT         NOT NULL DEFAULT 0 CHECK (float_khr >= 0),
    closed_at       TIMESTAMPTZ,
    closed_by_name  VARCHAR(80),
    counted_usd     NUMERIC(12, 2),
    expected_usd    NUMERIC(12, 2),
    difference      NUMERIC(12, 2),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_pos_shift_open ON pos_shift (business_id) WHERE closed_at IS NULL;
CREATE INDEX ix_pos_shift_business ON pos_shift (business_id, opened_at DESC);

CREATE TABLE pos_cash_move (
    id          UUID           PRIMARY KEY,
    shift_id    UUID           NOT NULL REFERENCES pos_shift (id) ON DELETE CASCADE,
    amount      NUMERIC(12, 2) NOT NULL CHECK (amount <> 0),
    note        VARCHAR(80)    NOT NULL DEFAULT '',
    by_user_id  UUID           REFERENCES users (id) ON DELETE SET NULL,
    by_name     VARCHAR(80),
    at          TIMESTAMPTZ    NOT NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_pos_cash_move_shift ON pos_cash_move (shift_id, at);

ALTER TABLE sale ADD CONSTRAINT fk_sale_shift FOREIGN KEY (shift_id) REFERENCES pos_shift (id) ON DELETE SET NULL;
CREATE INDEX ix_sale_shift ON sale (shift_id);

-- ── Refunds ────────────────────────────────────────────────────────────────────────────
CREATE TABLE sale_refund (
    id          UUID           PRIMARY KEY,
    sale_id     UUID           NOT NULL REFERENCES sale (id) ON DELETE CASCADE,
    shift_id    UUID           REFERENCES pos_shift (id) ON DELETE SET NULL,
    amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    method      VARCHAR(10)    NOT NULL CHECK (method IN ('KHQR', 'CARD', 'CASH')),
    restock     BOOLEAN        NOT NULL DEFAULT FALSE,
    by_user_id  UUID           REFERENCES users (id) ON DELETE SET NULL,
    by_name     VARCHAR(80),
    at          TIMESTAMPTZ    NOT NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_sale_refund_sale ON sale_refund (sale_id, at);
CREATE INDEX ix_sale_refund_shift ON sale_refund (shift_id);

CREATE TABLE sale_refund_line (
    id          UUID          PRIMARY KEY,
    refund_id   UUID          NOT NULL REFERENCES sale_refund (id) ON DELETE CASCADE,
    variant_id  UUID          NOT NULL REFERENCES product_variant (id),
    qty         INTEGER       NOT NULL CHECK (qty > 0),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_sale_refund_line_refund ON sale_refund_line (refund_id);

-- ── Reviews written by customers: tied to the order or booking they rate ───────────────────
ALTER TABLE review ADD COLUMN order_id UUID REFERENCES orders (id) ON DELETE SET NULL;
ALTER TABLE review ADD COLUMN appointment_id UUID REFERENCES appointment (id) ON DELETE SET NULL;
CREATE UNIQUE INDEX uq_review_order_item ON review (order_id, target_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX uq_review_booking_item ON review (appointment_id, target_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX ix_review_author ON review (author_id, at DESC);
