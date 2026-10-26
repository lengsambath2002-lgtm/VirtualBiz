-- Two-step sign-in for every account, not only staff (docs/api/two-step.md). An account with it
-- on gets a TWO_STEP ticket instead of a session from any sign-in, and trades it with a code from
-- the authenticator app (or a recovery code) at POST /api/auth/two-step. Five wrong codes use the
-- ticket up.
ALTER TABLE auth_ticket DROP CONSTRAINT auth_ticket_kind_check;
ALTER TABLE auth_ticket ADD CONSTRAINT auth_ticket_kind_check CHECK (kind IN ('RESET', 'PHONE', 'TWO_STEP'));
ALTER TABLE auth_ticket ADD COLUMN failures SMALLINT NOT NULL DEFAULT 0;
