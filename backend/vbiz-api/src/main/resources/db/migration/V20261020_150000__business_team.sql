-- Shop teams (docs/api/phase10-shop-team.md): an owner or manager invites a person by email to
-- join their business as MANAGER or STAFF, optionally linking an existing team member (a staff
-- record without a login, e.g. a stylist already on the calendar).
CREATE TABLE business_invite (
    id                UUID          PRIMARY KEY,
    business_id       UUID          NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    member_id         UUID          REFERENCES business_member (id) ON DELETE CASCADE,
    email             VARCHAR(254)  NOT NULL,
    name              VARCHAR(80)   NOT NULL,
    role              VARCHAR(10)   NOT NULL CHECK (role IN ('MANAGER', 'STAFF')),
    token_hash        VARCHAR(64)   NOT NULL UNIQUE,
    invited_by        UUID          REFERENCES users (id) ON DELETE SET NULL,
    invited_by_name   VARCHAR(80)   NOT NULL,
    expires_at        TIMESTAMPTZ   NOT NULL,
    accepted_at       TIMESTAMPTZ,
    accepted_user_id  UUID          REFERENCES users (id) ON DELETE SET NULL,
    revoked_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);
-- One open invite per person per business (a new one withdraws the old).
CREATE UNIQUE INDEX uq_business_invite_open ON business_invite (business_id, email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX ix_business_invite_business ON business_invite (business_id, created_at DESC);
