-- Derived web-friendly video (H.264 mp4) + poster keys, produced by the
-- background transcode job. Runs once (tracked by the _migrations ledger).
ALTER TABLE photos ADD COLUMN transcoded_key TEXT;
ALTER TABLE photos ADD COLUMN poster_key TEXT;
