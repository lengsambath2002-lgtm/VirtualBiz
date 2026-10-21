-- docs/api/phase13-messages.md: shareable receipts, the provider's decline message, and booking
-- reminders actually sent.

-- A sale's public receipt link (/r/{token}); null until the shop first shares it.
ALTER TABLE sale ADD COLUMN share_token VARCHAR(64);
CREATE UNIQUE INDEX uq_sale_share_token ON sale (share_token) WHERE share_token IS NOT NULL;

-- What the provider wrote to the client when declining (shown to the client).
ALTER TABLE appointment ADD COLUMN decline_message VARCHAR(300);
-- When the booking reminder went out (the job sends each once).
ALTER TABLE appointment ADD COLUMN reminded_at TIMESTAMPTZ;
