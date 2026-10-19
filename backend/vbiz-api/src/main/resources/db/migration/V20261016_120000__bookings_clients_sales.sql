-- Phase 4: clients, appointments, calendar blocks, provider sales (docs/api/phase4-bookings-provider.md).
-- IDs are UUIDs; money is NUMERIC(12,2) USD; dates are Phnom Penh calendar dates, times of day
-- are minutes from midnight; instants are TIMESTAMPTZ (UTC).

-- ── Clients: a business's customer records (CRM). user_id links an online booker's account ──
CREATE TABLE client (
    id           UUID          PRIMARY KEY,
    business_id  UUID          NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    user_id      UUID          REFERENCES users (id) ON DELETE SET NULL,
    name         VARCHAR(80)   NOT NULL,
    phone        VARCHAR(10)   NOT NULL,
    email        VARCHAR(254),
    note         VARCHAR(500),
    since        TIMESTAMPTZ   NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_client_phone UNIQUE (business_id, phone),
    CONSTRAINT ck_client_phone CHECK (phone ~ '^0[1-9][0-9]{7,8}$')
);
CREATE UNIQUE INDEX uq_client_user ON client (business_id, user_id) WHERE user_id IS NOT NULL;

-- ── Appointments ────────────────────────────────────────────────────────────────────
-- BK- numbers continue from the seeded history (the seed moves the sequence).
CREATE SEQUENCE booking_number_seq START WITH 1 MINVALUE 1;

CREATE TABLE appointment (
    id             UUID           PRIMARY KEY,
    number         VARCHAR(12)    NOT NULL UNIQUE,
    business_id    UUID           NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    client_id      UUID           NOT NULL REFERENCES client (id),
    -- the account that booked online (the customer's "My bookings"); null for phone / walk-in
    customer_id    UUID           REFERENCES users (id) ON DELETE SET NULL,
    service_id     UUID           NOT NULL REFERENCES service (id),
    staff_id       UUID           NOT NULL REFERENCES business_member (id),
    date           DATE           NOT NULL,
    start_min      SMALLINT       NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
    duration_min   SMALLINT       NOT NULL CHECK (duration_min BETWEEN 5 AND 600),
    price          NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    status         VARCHAR(10)    NOT NULL CHECK (status IN ('REQUESTED', 'BOOKED', 'CONFIRMED', 'ARRIVED',
                       'STARTED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'DECLINED')),
    source         VARCHAR(8)     NOT NULL CHECK (source IN ('ONLINE', 'PHONE', 'WALK_IN')),
    note           VARCHAR(200),
    sale_id        UUID,
    rescheduled    BOOLEAN        NOT NULL DEFAULT FALSE,
    cancel_reason  VARCHAR(40),
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_appointment_number CHECK (number ~ '^BK-[0-9]{5,}$')
);
CREATE INDEX ix_appointment_business_date ON appointment (business_id, date, start_min);
CREATE INDEX ix_appointment_staff_date ON appointment (staff_id, date);
CREATE INDEX ix_appointment_customer ON appointment (customer_id, date DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX ix_appointment_client ON appointment (client_id);

-- The activity log. `before` is the undo snapshot ({status, serviceId, staffId, date, start,
-- durationMin, price, note}) of a change the shop made; null when it cannot be undone.
CREATE TABLE appointment_event (
    id              UUID          PRIMARY KEY,
    appointment_id  UUID          NOT NULL REFERENCES appointment (id) ON DELETE CASCADE,
    code            VARCHAR(20)   NOT NULL,
    params          JSONB         NOT NULL DEFAULT '{}'::jsonb,
    before          JSONB,
    by_user_id      UUID          REFERENCES users (id) ON DELETE SET NULL,
    at              TIMESTAMPTZ   NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_appointment_event_appointment ON appointment_event (appointment_id, at);

-- ── Calendar blocks (lunch, training, …) ────────────────────────────────────────────
CREATE TABLE calendar_block (
    id            UUID          PRIMARY KEY,
    business_id   UUID          NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    staff_id      UUID          NOT NULL REFERENCES business_member (id) ON DELETE CASCADE,
    date          DATE          NOT NULL,
    start_min     SMALLINT      NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
    duration_min  SMALLINT      NOT NULL CHECK (duration_min BETWEEN 15 AND 720),
    reason        VARCHAR(10)   NOT NULL CHECK (reason IN ('LUNCH', 'BREAK', 'TRAINING', 'PERSONAL', 'CLEANING')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_calendar_block_business_date ON calendar_block (business_id, date);

-- ── Sales (provider checkout now; the Seller POS joins in Phase 5 with shift_id) ────────
CREATE SEQUENCE sale_number_seq START WITH 1 MINVALUE 1;

CREATE TABLE sale (
    id              UUID           PRIMARY KEY,
    number          VARCHAR(12)    NOT NULL UNIQUE,
    business_id     UUID           NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    appointment_id  UUID           REFERENCES appointment (id) ON DELETE SET NULL,
    client_id       UUID           REFERENCES client (id) ON DELETE SET NULL,
    shift_id        UUID,
    subtotal        NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tip             NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (tip >= 0),
    total           NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
    -- {usd, khr, change} when paid in cash
    cash            JSONB,
    by_user_id      UUID           REFERENCES users (id) ON DELETE SET NULL,
    by_name         VARCHAR(80),
    at              TIMESTAMPTZ    NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_sale_number CHECK (number ~ '^S-[0-9]{5,}$'),
    CONSTRAINT ck_sale_total CHECK (total = subtotal - discount + tip)
);
CREATE INDEX ix_sale_business_at ON sale (business_id, at DESC);
CREATE INDEX ix_sale_client ON sale (client_id);

CREATE TABLE sale_line (
    id          UUID           PRIMARY KEY,
    sale_id     UUID           NOT NULL REFERENCES sale (id) ON DELETE CASCADE,
    position    INTEGER        NOT NULL,
    service_id  UUID           REFERENCES service (id) ON DELETE SET NULL,
    variant_id  UUID           REFERENCES product_variant (id) ON DELETE SET NULL,
    title       VARCHAR(160)   NOT NULL,
    qty         SMALLINT       NOT NULL CHECK (qty BETWEEN 1 AND 99),
    unit_price  NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    staff_id    UUID           REFERENCES business_member (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_sale_line_item CHECK (service_id IS NULL OR variant_id IS NULL)
);
CREATE INDEX ix_sale_line_sale ON sale_line (sale_id, position);

CREATE TABLE sale_payment (
    id          UUID           PRIMARY KEY,
    sale_id     UUID           NOT NULL REFERENCES sale (id) ON DELETE CASCADE,
    position    INTEGER        NOT NULL,
    method      VARCHAR(10)    NOT NULL CHECK (method IN ('KHQR', 'CARD', 'CASH')),
    amount      NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX ix_sale_payment_sale ON sale_payment (sale_id, position);

ALTER TABLE appointment
    ADD CONSTRAINT fk_appointment_sale FOREIGN KEY (sale_id) REFERENCES sale (id) ON DELETE SET NULL;
