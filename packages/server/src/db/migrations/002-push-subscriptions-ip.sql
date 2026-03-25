-- Add IP address tracking for per-IP subscription caps
ALTER TABLE push_subscriptions ADD COLUMN ip_address TEXT;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_ip_status
  ON push_subscriptions (ip_address, status);
