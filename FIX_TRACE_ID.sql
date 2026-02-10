-- ============================================================
-- MINIMAL FIX: trace_id Column + Schema Refresh
-- ============================================================
-- 
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mlraxwphcjrfjzfojetq/sql
--
-- This fixes: "Could not find the 'trace_id' column of 'upload'"
-- ============================================================

-- Step 1: Create upload table if not exists
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

-- Step 2: Add missing columns to existing upload table (if it exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'upload' AND column_name = 'trace_id') THEN
    ALTER TABLE public.upload ADD COLUMN trace_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'upload' AND column_name = 'progress') THEN
    ALTER TABLE public.upload ADD COLUMN progress DOUBLE PRECISION DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'upload' AND column_name = 'processing_stage') THEN
    ALTER TABLE public.upload ADD COLUMN processing_stage TEXT DEFAULT 'starting';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'upload' AND column_name = 'user_id') THEN
    ALTER TABLE public.upload ADD COLUMN user_id UUID;
  END IF;
END $$;

-- Step 3: Create jobs table if not exists
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES public.upload(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  progress INTEGER DEFAULT 0,
  stage TEXT DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Create debug_events table for tracing
CREATE TABLE IF NOT EXISTS public.debug_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id TEXT NOT NULL,
  source TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_events_trace ON public.debug_events(trace_id);

-- Step 5: Enable RLS
ALTER TABLE public.upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debug_events ENABLE ROW LEVEL SECURITY;

-- Step 6: Create permissive policies (for dev)
DROP POLICY IF EXISTS "Allow all upload" ON public.upload;
CREATE POLICY "Allow all upload" ON public.upload FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all jobs" ON public.jobs;
CREATE POLICY "Allow all jobs" ON public.jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all debug_events" ON public.debug_events;
CREATE POLICY "Allow all debug_events" ON public.debug_events FOR ALL USING (true) WITH CHECK (true);

-- Step 7: CRITICAL - Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFY: Run these queries to confirm fix
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'upload' AND table_schema = 'public';
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
