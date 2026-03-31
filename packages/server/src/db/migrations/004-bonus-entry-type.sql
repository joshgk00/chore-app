-- Add 'bonus' to points_ledger entry_type constraint for bonus approval points

-- SQLite doesn't support ALTER TABLE ... ALTER COLUMN, so we rebuild the table
CREATE TABLE points_ledger_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('routine', 'chore', 'reward', 'manual', 'bonus')),
  reference_table TEXT,
  reference_id INTEGER,
  amount INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO points_ledger_new SELECT * FROM points_ledger;

DROP TABLE points_ledger;

ALTER TABLE points_ledger_new RENAME TO points_ledger;

CREATE INDEX IF NOT EXISTS idx_points_ledger_created_at ON points_ledger(created_at);

-- Add bonus_approval_points setting for existing installs that already have settings
INSERT INTO settings (key, value)
  SELECT 'bonus_approval_points', '0'
  WHERE EXISTS (SELECT 1 FROM settings WHERE key = 'timezone')
  AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'bonus_approval_points');
