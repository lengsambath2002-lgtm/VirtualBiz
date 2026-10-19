-- Platform super-admin (docs/api/phase7-admin.md): platform roles, account and shop suspension,
-- verification decisions, review moderation, shop payouts and the admin audit log.

-- ── Accounts ─────────────────────────────────────────────────────────────────────────────
-- NULL = an ordinary account. ADMIN runs the console; SUPER_ADMIN also manages admins.
ALTER TABLE users ADD COLUMN platform_role     VARCHAR(20)
    CHECK (platform_role IN ('ADMIN', 'SUPER_ADMIN'));
-- A suspended account cannot sign in and its sessions are revoked.
ALTER TABLE users ADD COLUMN suspended_at      TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN suspended_reason  VARCHAR(300);
CREATE INDEX ix_users_platform_role ON users (platform_role) WHERE platform_role IS NOT NULL;
CREATE INDEX ix_users_created ON users (created_at DESC);

-- ── Businesses ───────────────────────────────────────────────────────────────────────────
-- Verification decision: when, by whom, and the reason shown to the owner on rejection.
ALTER TABLE business ADD COLUMN verification_note VARCHAR(300);
ALTER TABLE business ADD COLUMN verified_at       TIMESTAMPTZ;
ALTER TABLE business ADD COLUMN verified_by       UUID REFERENCES users (id) ON DELETE SET NULL;
-- A suspended shop is hidden from the marketplace and takes no orders or bookings.
ALTER TABLE business ADD COLUMN suspended_at      TIMESTAMPTZ;
ALTER TABLE business ADD COLUMN suspended_reason  VARCHAR(300);
CREATE INDEX ix_business_verification ON business (verification, created_at DESC);

-- ── Review moderation ────────────────────────────────────────────────────────────────────
-- A hidden review no longer shows anywhere public and leaves the ratings.
ALTER TABLE review ADD COLUMN hidden_at      TIMESTAMPTZ;
ALTER TABLE review ADD COLUMN hidden_reason  VARCHAR(300);

-- ── Payouts ──────────────────────────────────────────────────────────────────────────────
-- One transfer to a shop's Bakong account, covering the online payments it settles.
CREATE TABLE payout (
    id              UUID           PRIMARY KEY,
    business_id     UUID           NOT NULL REFERENCES business (id) ON DELETE RESTRICT,
    -- released payments minus refunds taken back, and the commission on that
    gross           NUMERIC(12, 2) NOT NULL CHECK (gross > 0),
    commission      NUMERIC(12, 2) NOT NULL,
    amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payments_count  INTEGER        NOT NULL CHECK (payments_count > 0),
    bakong_id       VARCHAR(100)   NOT NULL,
    reference       VARCHAR(80)    NOT NULL,
    note            VARCHAR(300),
    paid_at         TIMESTAMPTZ    NOT NULL,
    paid_by         UUID           REFERENCES users (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT ck_payout_amount CHECK (amount = gross - commission)
);
CREATE INDEX ix_payout_business ON payout (business_id, paid_at DESC);
CREATE INDEX ix_payout_paid ON payout (paid_at DESC);

-- payout_id: the payout that paid this payment to the shop. A payment refunded after that is
-- taken back from the shop's next payout (clawback_payout_id).
ALTER TABLE payment ADD COLUMN payout_id UUID REFERENCES payout (id) ON DELETE RESTRICT;
ALTER TABLE payment ADD COLUMN clawback_payout_id UUID REFERENCES payout (id) ON DELETE RESTRICT;
CREATE INDEX ix_payment_unpaid_online ON payment (status, channel) WHERE payout_id IS NULL;

-- ── Audit log ────────────────────────────────────────────────────────────────────────────
-- Every admin action, append-only.
CREATE TABLE admin_audit (
    id            UUID          PRIMARY KEY,
    actor_id      UUID          REFERENCES users (id) ON DELETE SET NULL,
    actor_name    VARCHAR(80)   NOT NULL,
    action        VARCHAR(40)   NOT NULL,
    target_type   VARCHAR(20)   NOT NULL CHECK (target_type IN ('USER', 'BUSINESS', 'ORDER', 'REVIEW',
                      'PROMOTION', 'PAYOUT')),
    target_id     VARCHAR(64)   NOT NULL,
    target_label  VARCHAR(200),
    reason        VARCHAR(300),
    details       JSONB         NOT NULL DEFAULT '{}'::jsonb,
    at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_admin_audit_at ON admin_audit (at DESC);
CREATE INDEX ix_admin_audit_target ON admin_audit (target_type, target_id, at DESC);
