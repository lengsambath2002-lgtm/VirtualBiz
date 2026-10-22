-- What people did in a shop, for its owner and managers (docs/api/phase18-shop-activity.md).
-- Append-only: rows are never updated or deleted by the application.
CREATE TABLE shop_activity (
    id            UUID          PRIMARY KEY,
    business_id   UUID          NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    actor_id      UUID,
    actor_name    VARCHAR(80)   NOT NULL,
    action        VARCHAR(40)   NOT NULL,
    target_type   VARCHAR(20)   NOT NULL,
    target_id     VARCHAR(64),
    target_label  VARCHAR(200),
    details       JSONB         NOT NULL DEFAULT '{}'::jsonb,
    at            TIMESTAMPTZ   NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_shop_activity_business_at ON shop_activity (business_id, at DESC);
CREATE INDEX ix_shop_activity_target ON shop_activity (business_id, target_type, target_id);
