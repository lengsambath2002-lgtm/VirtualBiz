-- Console CSV exports are audited (docs/api/phase15-lists.md).
ALTER TABLE admin_audit DROP CONSTRAINT admin_audit_target_type_check;
ALTER TABLE admin_audit ADD CONSTRAINT admin_audit_target_type_check CHECK (target_type IN ('USER', 'BUSINESS',
    'ORDER', 'REVIEW', 'PROMOTION', 'PAYOUT', 'SETTINGS', 'CATEGORY', 'STAFF_INVITE', 'EXPORT'));
