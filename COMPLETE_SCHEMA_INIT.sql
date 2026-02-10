-- ============================================================
-- COMPLETE SCHEMA INITIALIZATION
-- finance-quest Database Setup
-- ============================================================
-- 
-- If you're seeing "upload table not found" errors, run this
-- ENTIRE script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mlraxwphcjrfjzfojetq/sql
--
-- This creates ALL required tables from scratch.
-- ============================================================

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

-- Guest Session Table
CREATE TABLE IF NOT EXISTS public.guest_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  upload_count INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT FALSE
);

-- Upload Table (MAIN TABLE - often missing!)
CREATE TABLE IF NOT EXISTS public.upload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token TEXT,
  user_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  progress DOUBLE PRECISION DEFAULT 0,
  processing_stage TEXT DEFAULT 'starting',
  statement_extract_id UUID,
  trace_id TEXT,
  error_message TEXT,
  attempt_count INT DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs Table (for async processing)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES public.upload(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  progress INTEGER DEFAULT 0,
  stage TEXT DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Statement Extract Table
CREATE TABLE IF NOT EXISTS public.statement_extract (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES upload(id) ON DELETE CASCADE,
  user_id UUID,
  guest_token TEXT,
  period TEXT,
  free_summary JSONB,
  confidence_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction Extract Table
CREATE TABLE IF NOT EXISTS public.transaction_extract (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES upload(id) ON DELETE CASCADE,
  statement_extract_id UUID REFERENCES statement_extract(id) ON DELETE CASCADE,
  user_id UUID,
  guest_token TEXT,
  date DATE,
  merchant TEXT,
  category TEXT,
  amount DECIMAL(10, 2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Items Table
CREATE TABLE IF NOT EXISTS public.subscription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  guest_token TEXT,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  frequency TEXT DEFAULT 'monthly',
  category TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  is_confirmed BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- 2. DEBUG TABLE (for tracing issues)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.debug_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  source TEXT NOT NULL,        -- 'app' | 'parse-statement' | 'process-job'
  level TEXT NOT NULL,         -- 'info' | 'warn' | 'error'
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_events_trace ON public.debug_events(trace_id);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_guest_session_token ON guest_session(guest_token);
CREATE INDEX IF NOT EXISTS idx_upload_guest_token ON upload(guest_token);
CREATE INDEX IF NOT EXISTS idx_upload_user_id ON upload(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_status ON upload(status);
CREATE INDEX IF NOT EXISTS idx_jobs_upload_id ON jobs(upload_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_statement_extract_upload ON statement_extract(upload_id);
CREATE INDEX IF NOT EXISTS idx_statement_extract_user ON statement_extract(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_extract_upload ON transaction_extract(upload_id);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.guest_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_extract ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_extract ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debug_events ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development (tighten for production!)
DROP POLICY IF EXISTS "Allow all guest_session" ON public.guest_session;
CREATE POLICY "Allow all guest_session" ON public.guest_session FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all upload" ON public.upload;
CREATE POLICY "Allow all upload" ON public.upload FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all jobs" ON public.jobs;
CREATE POLICY "Allow all jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all statement_extract" ON public.statement_extract;
CREATE POLICY "Allow all statement_extract" ON public.statement_extract FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all transaction_extract" ON public.transaction_extract;
CREATE POLICY "Allow all transaction_extract" ON public.transaction_extract FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all subscription_items" ON public.subscription_items;
CREATE POLICY "Allow all subscription_items" ON public.subscription_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all debug_events" ON public.debug_events;
CREATE POLICY "Allow all debug_events" ON public.debug_events FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

-- Auto-update updated_at on upload
CREATE OR REPLACE FUNCTION update_upload_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_upload_updated_at ON public.upload;
CREATE TRIGGER trigger_update_upload_updated_at
  BEFORE UPDATE ON public.upload
  FOR EACH ROW
  EXECUTE FUNCTION update_upload_updated_at();

-- Auto-update updated_at on jobs
CREATE OR REPLACE FUNCTION touch_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_updated_at ON public.jobs;
CREATE TRIGGER trg_job_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION touch_job_updated_at();

-- ============================================================
-- 6. HELPER FUNCTIONS
-- ============================================================

-- Check if guest can upload
CREATE OR REPLACE FUNCTION can_guest_upload(p_guest_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_session guest_session%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM guest_session WHERE guest_token = p_guest_token;
  IF NOT FOUND THEN
    INSERT INTO guest_session (guest_token, upload_count, used)
    VALUES (p_guest_token, 0, FALSE)
    RETURNING * INTO v_session;
  END IF;
  IF v_session.used THEN RETURN FALSE; END IF;
  IF v_session.upload_count >= 1 THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark guest as used
CREATE OR REPLACE FUNCTION mark_guest_used(p_guest_token TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE guest_session SET used = TRUE, upload_count = upload_count + 1
  WHERE guest_token = p_guest_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get guest free summary
DROP FUNCTION IF EXISTS get_guest_free_summary(p_guest_token TEXT);
CREATE OR REPLACE FUNCTION get_guest_free_summary(p_guest_token TEXT)
RETURNS SETOF JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT free_summary
  FROM public.statement_extract
  WHERE guest_token = p_guest_token
  ORDER BY created_at DESC;
$$;

-- ============================================================
-- 7. REFRESH POSTGREST CACHE
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE! Verify by running:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================================
