-- Add index on event_type to support filtered queries (e.g., bootstrap lastApprovalAt)
CREATE INDEX IF NOT EXISTS idx_activity_events_event_type ON activity_events(event_type, created_at DESC);
