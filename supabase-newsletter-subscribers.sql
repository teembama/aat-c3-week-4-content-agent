-- Newsletter subscribers — recipients for the newsletter channel.
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  added_by uuid REFERENCES auth.users(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service role" ON newsletter_subscribers;
CREATE POLICY "Allow all for service role" ON newsletter_subscribers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow anon read" ON newsletter_subscribers;
CREATE POLICY "Allow anon read" ON newsletter_subscribers FOR SELECT USING (true);
