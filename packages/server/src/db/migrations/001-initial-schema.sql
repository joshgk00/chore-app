-- Milestone 1: Initial schema
-- All 14 tables from spec section 14

-- Settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Routines
CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('morning', 'afternoon', 'bedtime', 'anytime')),
  completion_rule TEXT NOT NULL CHECK (completion_rule IN ('once_per_day', 'once_per_slot', 'unlimited')),
  points INTEGER NOT NULL DEFAULT 0,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  image_asset_id INTEGER REFERENCES assets(id),
  randomize_items INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

-- Checklist items
CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id),
  label TEXT NOT NULL,
  image_asset_id INTEGER REFERENCES assets(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

-- Chores
CREATE TABLE IF NOT EXISTS chores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

-- Chore tiers
CREATE TABLE IF NOT EXISTS chore_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chore_id INTEGER NOT NULL REFERENCES chores(id),
  name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

-- Rewards
CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost >= 0),
  image_asset_id INTEGER REFERENCES assets(id),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

-- Assets
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('upload', 'ai_generated')),
  reusable INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
  original_filename TEXT,
  stored_filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  prompt TEXT,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

-- Routine completions
CREATE TABLE IF NOT EXISTS routine_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id),
  routine_name_snapshot TEXT NOT NULL,
  time_slot_snapshot TEXT NOT NULL,
  completion_rule_snapshot TEXT NOT NULL,
  points_snapshot INTEGER NOT NULL,
  requires_approval_snapshot INTEGER NOT NULL,
  checklist_snapshot_json TEXT,
  randomized_order_json TEXT,
  completion_window_key TEXT,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  local_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
  review_note TEXT,
  reviewed_at TEXT,
  idempotency_key TEXT UNIQUE
);

-- Chore logs
CREATE TABLE IF NOT EXISTS chore_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chore_id INTEGER NOT NULL REFERENCES chores(id),
  chore_name_snapshot TEXT NOT NULL,
  tier_id INTEGER REFERENCES chore_tiers(id),
  tier_name_snapshot TEXT,
  points_snapshot INTEGER NOT NULL,
  requires_approval_snapshot INTEGER NOT NULL,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  local_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
  review_note TEXT,
  reviewed_at TEXT,
  idempotency_key TEXT UNIQUE
);

-- Reward requests
CREATE TABLE IF NOT EXISTS reward_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reward_id INTEGER NOT NULL REFERENCES rewards(id),
  reward_name_snapshot TEXT NOT NULL,
  cost_snapshot INTEGER NOT NULL,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  local_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'canceled')),
  review_note TEXT,
  reviewed_at TEXT,
  canceled_at TEXT,
  idempotency_key TEXT UNIQUE
);

-- Points ledger
CREATE TABLE IF NOT EXISTS points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('routine', 'chore', 'reward', 'manual')),
  reference_table TEXT,
  reference_id INTEGER,
  amount INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Badges earned
CREATE TABLE IF NOT EXISTS badges_earned (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  badge_key TEXT NOT NULL UNIQUE,
  earned_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('child', 'admin')),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_success_at TEXT,
  last_failure_at TEXT
);

-- Admin sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Activity events
CREATE TABLE IF NOT EXISTS activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  summary TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_routine_completions_status ON routine_completions(status);
CREATE INDEX IF NOT EXISTS idx_routine_completions_local_date ON routine_completions(local_date);
CREATE INDEX IF NOT EXISTS idx_chore_logs_status ON chore_logs(status);
CREATE INDEX IF NOT EXISTS idx_chore_logs_local_date ON chore_logs(local_date);
CREATE INDEX IF NOT EXISTS idx_reward_requests_status ON reward_requests(status);
CREATE INDEX IF NOT EXISTS idx_reward_requests_status_date ON reward_requests(status, local_date);
CREATE INDEX IF NOT EXISTS idx_points_ledger_created_at ON points_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
