-- Single sign-on with the Business Platform and shop links (docs/adr/0003-sso-with-the-business-platform.md,
-- contract: business-platform docs/integrations/virtualbiz-sso.md).

-- A sign-in through the platform is its own sign-in method.
ALTER TABLE user_sign_in_method DROP CONSTRAINT user_sign_in_method_method_check;
ALTER TABLE user_sign_in_method ADD CONSTRAINT user_sign_in_method_method_check
    CHECK (method IN ('PASSWORD', 'GOOGLE', 'EMAIL_CODE', 'PHONE_SMS', 'PLATFORM'));

-- SSO_STATE: one started sign-in (token = the OAuth state), with the sealed PKCE verifier, the nonce
-- hash, the intent and where to go next in data. SSO_LINK: a platform identity waiting for the
-- matching VirtualBiz account to sign in and confirm the link (user_id = that account).
ALTER TABLE auth_ticket DROP CONSTRAINT auth_ticket_kind_check;
ALTER TABLE auth_ticket ADD CONSTRAINT auth_ticket_kind_check
    CHECK (kind IN ('RESET', 'PHONE', 'TWO_STEP', 'SSO_STATE', 'SSO_LINK'));
ALTER TABLE auth_ticket ADD COLUMN data JSONB;

-- External identities linked to an account. sub is the only key: never matched by email.
-- orgs / claims_at: the organisations and roles from the latest ID token (connecting a shop needs
-- them fresh).
CREATE TABLE user_identity (
    id              UUID          PRIMARY KEY,
    provider        VARCHAR(20)   NOT NULL CHECK (provider IN ('PLATFORM')),
    subject         VARCHAR(255)  NOT NULL,
    user_id         UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email           VARCHAR(254),
    name            VARCHAR(200),
    locale          VARCHAR(10),
    orgs            JSONB         NOT NULL DEFAULT '[]'::jsonb,
    claims_at       TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_identity_subject UNIQUE (provider, subject),
    CONSTRAINT uq_user_identity_user UNIQUE (user_id, provider)
);

-- The platform organisation a shop is linked to (one per shop; an organisation can have several).
ALTER TABLE business ADD COLUMN platform_org_id UUID;
ALTER TABLE business ADD COLUMN platform_org_name VARCHAR(200);
ALTER TABLE business ADD COLUMN platform_linked_at TIMESTAMPTZ;
ALTER TABLE business ADD COLUMN platform_linked_by UUID REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX ix_business_platform_org ON business (platform_org_id) WHERE platform_org_id IS NOT NULL;

-- Members whose access follows their platform organisation role (updated on every platform sign-in).
-- The owner row and staff added by hand are never platform-managed.
ALTER TABLE business_member ADD COLUMN platform_managed BOOLEAN NOT NULL DEFAULT FALSE;
