-- ============================================================
-- Therese — Week 4: AI Content Research & Publishing Agent
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

-- 1. Content requests (intake)
create table if not exists content_requests (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  audience text not null,
  source_url text,
  tone text not null default 'professional'
    check (tone in ('professional', 'conversational', 'technical', 'thought-leadership')),
  primary_keyword text,
  additional_context text,
  status text not null default 'draft'
    check (status in (
      'draft', 'researching', 'generating', 'evaluating',
      'revising', 'adapting', 'review', 'approved', 'published', 'failed'
    )),
  notifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Research sources
create table if not exists research_sources (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references content_requests(id) on delete cascade,
  url text not null,
  title text not null,
  content_markdown text not null,
  relevance_score real not null default 0,
  key_claims jsonb not null default '[]'::jsonb,
  source_type text not null
    check (source_type in ('web_search', 'user_url')),
  created_at timestamptz not null default now()
);

create index if not exists idx_research_sources_request
  on research_sources(request_id);

-- 3. Content drafts
create table if not exists content_drafts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references content_requests(id) on delete cascade,
  draft_number integer not null,
  angle_description text not null,
  article_markdown text not null,
  article_html text not null default '',
  source_references jsonb not null default '[]'::jsonb,
  evaluation jsonb,
  revision_history jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'revised', 'selected', 'approved', 'rejected')),
  created_at timestamptz not null default now(),

  unique(request_id, draft_number)
);

create index if not exists idx_content_drafts_request
  on content_drafts(request_id);

-- 4. Publishing queue
create table if not exists publishing_queue (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references content_requests(id) on delete cascade,
  draft_id uuid not null references content_drafts(id) on delete cascade,
  channel text not null
    check (channel in ('linkedin', 'x', 'newsletter')),
  formatted_content text not null,
  subject_line text,
  preview_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'published', 'rejected')),
  approved_by text,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),

  unique(draft_id, channel)
);

create index if not exists idx_publishing_queue_request
  on publishing_queue(request_id);

-- Auto-update updated_at on content_requests
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_content_requests_updated_at
  before update on content_requests
  for each row execute function update_updated_at();

-- RLS: disable for now (single-user project, service role key used server-side)
alter table content_requests enable row level security;
alter table research_sources enable row level security;
alter table content_drafts enable row level security;
alter table publishing_queue enable row level security;

-- Allow all operations for service role (and anon for reads on the dashboard)
create policy "Allow all for service role" on content_requests for all using (true);
create policy "Allow all for service role" on research_sources for all using (true);
create policy "Allow all for service role" on content_drafts for all using (true);
create policy "Allow all for service role" on publishing_queue for all using (true);
