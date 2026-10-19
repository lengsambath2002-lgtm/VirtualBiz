-- Phase 3: cart, checkout, orders, payments, notifications (docs/api/phase3-orders-checkout.md).
-- IDs are UUIDs; money is NUMERIC(12,2) USD; times are TIMESTAMPTZ (UTC).

-- ── Cart: the signed-in customer's lines and saved-for-later ─────────────────────────
CREATE TABLE cart_line (
    id               UUID          PRIMARY KEY,
    user_id          UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    variant_id       UUID          NOT NULL REFERENCES product_variant (id) ON DELETE CASCADE,
    qty              INTEGER       NOT NULL CHECK (qty BETWEEN 1 AND 999),
    selected         BOOLEAN       NOT NULL DEFAULT TRUE,
    saved_for_later  BOOLEAN       NOT NULL DEFAULT FALSE,
    position         INTEGER       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_cart_line UNIQUE (user_id, saved_for_later, variant_id)
);
CREATE INDEX ix_cart_line_user ON cart_line (user_id, saved_for_later, position);

-- ── Orders ──────────────────────────────────────────────────────────────────────────
-- VB- numbers continue from the seeded history (the seed moves the sequence).
CREATE SEQUENCE order_number_seq START WITH 1 MINVALUE 1;

-- One customer checkout (possibly several shops = several orders). The idempotency key makes a
-- retried POST /api/checkout return the stored result instead of placing twice.
CREATE TABLE checkout (
    id                UUID          PRIMARY KEY,
    customer_id       UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    idempotency_key   VARCHAR(64)   NOT NULL,
    request_hash      VARCHAR(64)   NOT NULL,
    payment_method    VARCHAR(10)   NOT NULL CHECK (payment_method IN ('KHQR', 'CARD', 'CASH')),
    total             NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_checkout_key UNIQUE (customer_id, idempotency_key)
);

CREATE TABLE orders (
    id                 UUID           PRIMARY KEY,
    number             VARCHAR(12)    NOT NULL UNIQUE,
    checkout_id        UUID           REFERENCES checkout (id) ON DELETE SET NULL,
    business_id        UUID           NOT NULL REFERENCES business (id),
    customer_id        UUID           NOT NULL REFERENCES users (id),
    status             VARCHAR(10)    NOT NULL CHECK (status IN ('NEW', 'ACCEPTED', 'PACKED', 'SHIPPED',
                           'DELIVERED', 'PICKED_UP', 'CANCELLED', 'RETURNED')),
    method             VARCHAR(10)    NOT NULL CHECK (method IN ('DELIVERY', 'PICKUP')),
    -- {label, name, phone, line, district, note?, lat?, lng?} snapshot at checkout (DELIVERY)
    address            JSONB,
    delivery_window    VARCHAR(11),
    scheduled_for      TIMESTAMPTZ,
    note               VARCHAR(120),
    subtotal           NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount           NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    promo_discount     NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (promo_discount >= 0),
    promo_code         VARCHAR(30),
    promotion_id       UUID           REFERENCES promotion (id) ON DELETE SET NULL,
    delivery_fee       NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    total              NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    delivery_by        VARCHAR(20)    CHECK (delivery_by IN ('VIRTUALBIZ_RIDER', 'OWN_DELIVERY')),
    -- {name, vehicle, plate} of the VirtualBiz rider
    rider              JSONB,
    cancel_reason      VARCHAR(40),
    reviewed           BOOLEAN        NOT NULL DEFAULT FALSE,
    -- placed_at: visible to the shop (KHQR: once paid). Null while a KHQR payment is pending.
    placed_at          TIMESTAMPTZ,
    accepted_at        TIMESTAMPTZ,
    packed_at          TIMESTAMPTZ,
    shipped_at         TIMESTAMPTZ,
    fulfilled_at       TIMESTAMPTZ,
    cancelled_at       TIMESTAMPTZ,
    returned_at        TIMESTAMPTZ,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_orders_number CHECK (number ~ '^VB-[0-9]{5,}$'),
    CONSTRAINT ck_orders_address CHECK (method = 'PICKUP' OR address IS NOT NULL),
    CONSTRAINT ck_orders_total CHECK (total = subtotal - discount - promo_discount + delivery_fee)
);
CREATE INDEX ix_orders_business ON orders (business_id, placed_at DESC) WHERE placed_at IS NOT NULL;
CREATE INDEX ix_orders_business_status ON orders (business_id, status);
CREATE INDEX ix_orders_customer ON orders (customer_id, created_at DESC);
CREATE INDEX ix_orders_checkout ON orders (checkout_id);
-- The auto-cancel scan: placed orders still NEW.
CREATE INDEX ix_orders_new_placed ON orders (placed_at) WHERE status = 'NEW' AND placed_at IS NOT NULL;

CREATE TABLE order_line (
    id            UUID           PRIMARY KEY,
    order_id      UUID           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    variant_id    UUID           NOT NULL REFERENCES product_variant (id),
    product_id    UUID           NOT NULL REFERENCES product (id),
    product_slug  VARCHAR(90)    NOT NULL,
    title         VARCHAR(80)    NOT NULL,
    variant_name  VARCHAR(120)   NOT NULL DEFAULT '',
    -- {"Colour": "Black", …} in product option order
    options       JSONB          NOT NULL DEFAULT '{}'::jsonb,
    sku           VARCHAR(40)    NOT NULL DEFAULT '',
    qty           INTEGER        NOT NULL CHECK (qty BETWEEN 1 AND 999),
    list_price    NUMERIC(12, 2) NOT NULL CHECK (list_price > 0),
    unit_price    NUMERIC(12, 2) NOT NULL CHECK (unit_price > 0 AND unit_price <= list_price),
    position      INTEGER        NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_order_line_order ON order_line (order_id, position);
CREATE INDEX ix_order_line_variant ON order_line (variant_id);

-- Timeline: one row per status reached; note marks events that are not a step
-- ("failed.noAnswer" when a delivery comes back to PACKED).
CREATE TABLE order_event (
    id           UUID          PRIMARY KEY,
    order_id     UUID          NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    status       VARCHAR(10)   NOT NULL,
    note         VARCHAR(40),
    by_user_id   UUID          REFERENCES users (id) ON DELETE SET NULL,
    at           TIMESTAMPTZ   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_order_event_order ON order_event (order_id, at);

-- ── Payments ────────────────────────────────────────────────────────────────────────
-- A gateway session (KHQR or card) covering every order of one checkout.
CREATE TABLE payment_intent (
    id            UUID           PRIMARY KEY,
    checkout_id   UUID           NOT NULL REFERENCES checkout (id) ON DELETE CASCADE,
    customer_id   UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    method        VARCHAR(10)    NOT NULL CHECK (method IN ('KHQR', 'CARD')),
    status        VARCHAR(10)    NOT NULL CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'FAILED')),
    amount        NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    khqr          TEXT,
    khqr_md5      VARCHAR(32),
    gateway_ref   VARCHAR(80),
    expires_at    TIMESTAMPTZ,
    paid_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_payment_intent_pending ON payment_intent (expires_at) WHERE status = 'PENDING';
CREATE INDEX ix_payment_intent_checkout ON payment_intent (checkout_id);

-- One row per order (a split POS payment will be several rows in Phase 5).
CREATE TABLE payment (
    id            UUID           PRIMARY KEY,
    order_id      UUID           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    intent_id     UUID           REFERENCES payment_intent (id) ON DELETE SET NULL,
    method        VARCHAR(10)    NOT NULL CHECK (method IN ('KHQR', 'CARD', 'CASH')),
    channel       VARCHAR(10)    NOT NULL CHECK (channel IN ('ONLINE', 'COD', 'POS')),
    status        VARCHAR(10)    NOT NULL CHECK (status IN ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED', 'EXPIRED')),
    amount        NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    -- 5% VirtualBiz commission on ONLINE payments (0 for COD / POS)
    commission    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (commission >= 0),
    -- the shop's Bakong ID the payout goes to
    payout_to     VARCHAR(100),
    paid_at       TIMESTAMPTZ,
    refunded_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_payment_order ON payment (order_id) WHERE channel <> 'POS';
CREATE INDEX ix_payment_intent ON payment (intent_id);

-- ── Notifications (in-app inbox): a customer's (user_id) or a shop's (business_id) ──────
CREATE TABLE notification (
    id           UUID          PRIMARY KEY,
    user_id      UUID          REFERENCES users (id) ON DELETE CASCADE,
    business_id  UUID          REFERENCES business (id) ON DELETE CASCADE,
    kind         VARCHAR(30)   NOT NULL,
    params       JSONB         NOT NULL DEFAULT '{}'::jsonb,
    route        VARCHAR(200)  NOT NULL,
    unread       BOOLEAN       NOT NULL DEFAULT TRUE,
    at           TIMESTAMPTZ   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_notification_owner CHECK ((user_id IS NULL) <> (business_id IS NULL))
);
CREATE INDEX ix_notification_user ON notification (user_id, at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX ix_notification_business ON notification (business_id, at DESC) WHERE business_id IS NOT NULL;
