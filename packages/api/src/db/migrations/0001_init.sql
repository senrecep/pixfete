CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  uploader_name TEXT NOT NULL,
  uploader_phone TEXT,
  viewer_token TEXT NOT NULL UNIQUE,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  uploader_session_id TEXT NOT NULL REFERENCES upload_sessions(id),
  file_name TEXT NOT NULL,
  original_size INTEGER NOT NULL,
  storage_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  public_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  uploaded_at INTEGER NOT NULL,
  approved_at INTEGER,
  rejected_at INTEGER,
  rejection_reason TEXT,
  upload_complete INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  session_id TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_photos_session ON photos(uploader_session_id);
CREATE INDEX IF NOT EXISTS idx_photos_status ON photos(status);
CREATE INDEX IF NOT EXISTS idx_photos_status_complete ON photos(status, upload_complete);
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON photos(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_sessions_viewer_token ON upload_sessions(viewer_token);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
