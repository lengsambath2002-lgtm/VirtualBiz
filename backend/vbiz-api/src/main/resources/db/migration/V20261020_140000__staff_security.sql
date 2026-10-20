-- Staff security (docs/api/phase9-staff-security.md): forced password change, two-step sign-in
-- (TOTP) with recovery codes, per-session verification, and email invites for new staff.

-- Set by the first-start bootstrap (and invites never set it): the console asks for a new
-- password before anything else.
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
-- AES-GCM sealed TOTP secret (vbiz.security.data-key); set while enrolling, live once
-- mfa_enabled_at is set.
ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(200);
ALTER TABLE users ADD COLUMN mfa_enabled_at TIMESTAMPTZ;
-- The last TOTP time step accepted: a code can't be replayed.
ALTER TABLE users ADD COLUMN mfa_last_step BIGINT;

-- One-time recovery codes (SHA-256), for a lost phone.
CREATE TABLE mfa_recovery_code (
    id          UUID         PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash   VARCHAR(64)  NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_mfa_recovery_code_user ON mfa_recovery_code (user_id);

-- A sign-in (refresh-token family) that passed the two-step check, and wrong codes so far.
CREATE TABLE mfa_session (
    family_id    UUID         PRIMARY KEY,
    user_id      UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    verified_at  TIMESTAMPTZ,
    failures     INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE staff_invite (
    id                UUID          PRIMARY KEY,
    email             VARCHAR(254)  NOT NULL,
    name              VARCHAR(80)   NOT NULL,
    role              VARCHAR(20)   NOT NULL CHECK (role IN ('ADMIN', 'SUPER_ADMIN')),
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
-- One open invite per email (a new one withdraws the old).
CREATE UNIQUE INDEX uq_staff_invite_open ON staff_invite (email) WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE admin_audit DROP CONSTRAINT admin_audit_target_type_check;
ALTER TABLE admin_audit ADD CONSTRAINT admin_audit_target_type_check CHECK (target_type IN ('USER', 'BUSINESS',
    'ORDER', 'REVIEW', 'PROMOTION', 'PAYOUT', 'SETTINGS', 'CATEGORY', 'STAFF_INVITE'));
