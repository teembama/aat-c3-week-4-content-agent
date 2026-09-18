-- Cancellation flag for in-progress generation.
-- Generation checks this between steps and stops at the next boundary.
-- Run this in the Supabase SQL editor.

ALTER TABLE content_requests
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false;
