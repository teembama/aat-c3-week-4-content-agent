-- ============================================================
-- Therese — Week 4: Allow the client-side (anon key) dashboard reads
-- ============================================================
-- The dashboard, request detail, and publishing queue pages read
-- content_requests / research_sources / content_drafts / publishing_queue
-- directly from the browser using the Supabase anon key. The original
-- "Allow all for service role" policies are additive with these — this
-- does not remove or change anything, it only adds read access for the
-- anon/authenticated roles.

CREATE POLICY "Allow anon read" ON content_requests FOR SELECT USING (true);
CREATE POLICY "Allow anon read" ON research_sources FOR SELECT USING (true);
CREATE POLICY "Allow anon read" ON content_drafts FOR SELECT USING (true);
CREATE POLICY "Allow anon read" ON publishing_queue FOR SELECT USING (true);
