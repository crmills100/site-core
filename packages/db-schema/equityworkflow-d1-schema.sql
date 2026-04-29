-- Equity Work Flow — D1 Database Schema
-- Run with: npx wrangler d1 execute equityworkflow-forms --file=equityworkflow-d1-schema.sql

-- Beta access requests
CREATE TABLE IF NOT EXISTS beta_requests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name  TEXT NOT NULL,
  last_name   TEXT,
  email       TEXT NOT NULL,
  firm        TEXT NOT NULL,
  role        TEXT,
  deal_size   TEXT,
  status      TEXT DEFAULT 'pending',   -- pending | approved | declined
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);

-- Sign-in attempts log
CREATE TABLE IF NOT EXISTS signins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_beta_email    ON beta_requests(email);
CREATE INDEX IF NOT EXISTS idx_beta_status   ON beta_requests(status);
CREATE INDEX IF NOT EXISTS idx_signin_email  ON signins(email);

-- View: pending requests (useful query)
-- SELECT * FROM beta_requests WHERE status = 'pending' ORDER BY created_at DESC;
