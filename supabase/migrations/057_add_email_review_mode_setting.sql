-- Migration 057: Seed email_review_mode setting
-- Default: true (all emails redirect to kontakt@piotrbajerlein.pl for review)

INSERT INTO settings (key, value, description, created_at, updated_at)
VALUES (
  'email_review_mode',
  'true',
  'When true, all report emails redirect to kontakt@piotrbajerlein.pl for manual review before forwarding to clients',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;
