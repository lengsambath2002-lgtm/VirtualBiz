-- A team invite the person declined (docs/api/phase10-shop-team.md): closed like a withdrawn one,
-- and kept apart so the shop sees who said no.
ALTER TABLE business_invite ADD COLUMN declined_at TIMESTAMPTZ;
