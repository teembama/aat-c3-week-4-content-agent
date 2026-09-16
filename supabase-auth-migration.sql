-- ============================================================
-- Therese — Week 4: Auth, roles, and approval-reversal migration
-- Run this in the Supabase SQL Editor. Additive only — does not
-- modify or drop any existing columns, so existing data stays valid.
-- ============================================================

-- User profiles with roles
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'creator' CHECK (role IN ('creator', 'approver')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Service role can manage profiles" ON user_profiles FOR ALL USING (true);

-- Add creator_id to content_requests
ALTER TABLE content_requests ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id);

-- Update approved_by in publishing_queue to store user ID not free text
-- (existing text column stays for backward compat, add a typed one)
ALTER TABLE publishing_queue ADD COLUMN IF NOT EXISTS approved_by_id uuid REFERENCES auth.users(id);
ALTER TABLE publishing_queue ADD COLUMN IF NOT EXISTS unpublished_at timestamptz;
ALTER TABLE publishing_queue ADD COLUMN IF NOT EXISTS unpublished_by_id uuid REFERENCES auth.users(id);

-- ============================================================
-- After running this migration, sign up two accounts in the app.
-- Then manually set one to approver role:
--
--   UPDATE user_profiles SET role = 'approver' WHERE email = 'your-approver@email.com';
--
-- ============================================================
