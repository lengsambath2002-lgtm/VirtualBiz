-- A shop suggests a marketplace category; platform staff approve, map or reject it
-- (docs/api/phase19-category-requests.md).
CREATE TABLE category_request (
    id                 UUID          PRIMARY KEY,
    business_id        UUID          NOT NULL REFERENCES business (id) ON DELETE CASCADE,
    business_type      VARCHAR(10)   NOT NULL CHECK (business_type IN ('PRODUCT', 'SERVICE')),
    name               VARCHAR(40)   NOT NULL,
    name_kh            VARCHAR(40),
    note               VARCHAR(300),
    status             VARCHAR(10)   NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    requested_by       UUID          NOT NULL,
    requested_by_name  VARCHAR(80)   NOT NULL,
    decided_by_name    VARCHAR(80),
    decided_at         TIMESTAMPTZ,
    decision_note      VARCHAR(300),
    category_id        VARCHAR(40),
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
-- One open suggestion per shop at a time.
CREATE UNIQUE INDEX uq_category_request_open ON category_request (business_id) WHERE status = 'PENDING';
CREATE INDEX ix_category_request_status ON category_request (status, created_at);
