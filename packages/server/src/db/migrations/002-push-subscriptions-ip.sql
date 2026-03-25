-- Add IP address tracking for per-IP subscription caps
ALTER TABLE push_subscriptions ADD COLUMN ip_address TEXT;
