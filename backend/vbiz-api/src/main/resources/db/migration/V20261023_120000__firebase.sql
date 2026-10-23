-- docs/ops/firebase.md: the Firebase account a VirtualBiz account signs in with, and the devices
-- that get push notifications.
ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128);
CREATE UNIQUE INDEX uq_users_firebase_uid ON users (firebase_uid) WHERE firebase_uid IS NOT NULL;

CREATE TABLE push_token (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token       VARCHAR(512) NOT NULL,
    platform    VARCHAR(16) NOT NULL DEFAULT 'web',
    last_seen   TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_push_token ON push_token (token);
CREATE INDEX ix_push_token_user ON push_token (user_id);
