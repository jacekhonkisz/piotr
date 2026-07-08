-- Email scheduler tracking hardening
--
-- 1. Adds provider message ID + routed recipients to email_scheduler_logs so
--    scheduled/automated sends have a real audit trail (previously only the
--    manual /api/send-report path attempted to record a message ID).
-- 2. Adds a partial unique index so a successful scheduled send for the same
--    client + period can only be recorded once. This closes the
--    check-then-act race where overlapping cron invocations could both pass
--    the "already sent?" check and double-send.

ALTER TABLE email_scheduler_logs
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS recipients TEXT[];

-- Deduplicate any existing duplicate success rows before adding the index
-- (keeps the earliest row per client + period).
DELETE FROM email_scheduler_logs a
USING email_scheduler_logs b
WHERE a.email_sent = true
  AND b.email_sent = true
  AND a.operation_type = 'scheduled'
  AND b.operation_type = 'scheduled'
  AND a.client_id = b.client_id
  AND a.report_period_start = b.report_period_start
  AND a.report_period_end = b.report_period_end
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS email_scheduler_logs_unique_scheduled_send
  ON email_scheduler_logs (client_id, report_period_start, report_period_end)
  WHERE email_sent = true AND operation_type = 'scheduled';
