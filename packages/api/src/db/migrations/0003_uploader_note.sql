-- Optional free-text note an uploader can leave for the host.
-- Runs exactly once (tracked by the _migrations ledger), so a plain
-- ADD COLUMN is safe even though SQLite has no ADD COLUMN IF NOT EXISTS.
ALTER TABLE upload_sessions ADD COLUMN uploader_note TEXT;
