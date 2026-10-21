-- A person's named filter sets for a list (docs/api/phase17-more-lists.md).
CREATE TABLE saved_view (
    id          UUID          PRIMARY KEY,
    user_id     UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    list_key    VARCHAR(40)   NOT NULL,
    name        VARCHAR(60)   NOT NULL,
    query       VARCHAR(1000) NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_saved_view_name UNIQUE (user_id, list_key, name)
);
CREATE INDEX ix_saved_view_user_list ON saved_view (user_id, list_key);
