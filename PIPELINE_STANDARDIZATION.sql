-- ============================================================
-- PIPELINE STABILIZATION: Schema Standardization
-- ============================================================
-- 
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mlraxwphcjrfjzfojetq/sql
--
-- This ensures all "Must-have" columns exist for Step 1.
-- ============================================================

-- 1. Ensure Table existence
CREATE TABLE IF NOT EXISTS public.upload (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.jobs (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.statement_extract (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.transaction_extract (id UUID PRIMARY KEY DEFAULT gen_random_uuid());

-- 2. Standardize 'upload' table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='guest_token') THEN ALTER TABLE public.upload ADD COLUMN guest_token TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='file_path') THEN ALTER TABLE public.upload ADD COLUMN file_path TEXT NOT NULL DEFAULT 'unknown'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='status') THEN ALTER TABLE public.upload ADD COLUMN status TEXT DEFAULT 'pending'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='progress') THEN ALTER TABLE public.upload ADD COLUMN progress DOUBLE PRECISION DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='processing_stage') THEN ALTER TABLE public.upload ADD COLUMN processing_stage TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='statement_extract_id') THEN ALTER TABLE public.upload ADD COLUMN statement_extract_id UUID; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='trace_id') THEN ALTER TABLE public.upload ADD COLUMN trace_id TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='error_message') THEN ALTER TABLE public.upload ADD COLUMN error_message TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='file_name') THEN ALTER TABLE public.upload ADD COLUMN file_name TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='upload' AND column_name='created_at') THEN ALTER TABLE public.upload ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(); END IF;
END $$;

-- 3. Standardize 'jobs' table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='upload_id') THEN ALTER TABLE public.jobs ADD COLUMN upload_id UUID REFERENCES public.upload(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='status') THEN ALTER TABLE public.jobs ADD COLUMN status TEXT DEFAULT 'queued'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='attempts') THEN ALTER TABLE public.jobs ADD COLUMN attempts INTEGER DEFAULT 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='last_error') THEN ALTER TABLE public.jobs ADD COLUMN last_error TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='created_at') THEN ALTER TABLE public.jobs ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(); END IF;
END $$;

-- 4. Standardize 'statement_extract' table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='statement_extract' AND column_name='upload_id') THEN ALTER TABLE public.statement_extract ADD COLUMN upload_id UUID REFERENCES public.upload(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='statement_extract' AND column_name='guest_token') THEN ALTER TABLE public.statement_extract ADD COLUMN guest_token TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='statement_extract' AND column_name='free_summary') THEN ALTER TABLE public.statement_extract ADD COLUMN free_summary JSONB; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='statement_extract' AND column_name='confidence') THEN ALTER TABLE public.statement_extract ADD COLUMN confidence DOUBLE PRECISION; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='statement_extract' AND column_name='reconciliation') THEN ALTER TABLE public.statement_extract ADD COLUMN reconciliation JSONB; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='statement_extract' AND column_name='created_at') THEN ALTER TABLE public.statement_extract ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(); END IF;
END $$;

-- 5. Standardize 'transaction_extract' table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='upload_id') THEN ALTER TABLE public.transaction_extract ADD COLUMN upload_id UUID REFERENCES public.upload(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='statement_extract_id') THEN ALTER TABLE public.transaction_extract ADD COLUMN statement_extract_id UUID REFERENCES public.statement_extract(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='guest_token') THEN ALTER TABLE public.transaction_extract ADD COLUMN guest_token TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='date') THEN ALTER TABLE public.transaction_extract ADD COLUMN date DATE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='merchant') THEN ALTER TABLE public.transaction_extract ADD COLUMN merchant TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='category') THEN ALTER TABLE public.transaction_extract ADD COLUMN category TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='amount') THEN ALTER TABLE public.transaction_extract ADD COLUMN amount NUMERIC; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='description') THEN ALTER TABLE public.transaction_extract ADD COLUMN description TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transaction_extract' AND column_name='created_at') THEN ALTER TABLE public.transaction_extract ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(); END IF;
END $$;

-- 6. RPC: get_guest_free_summary (for future proofing)
DROP FUNCTION IF EXISTS get_guest_free_summary(TEXT);
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

-- 8. Performance Indices
CREATE INDEX IF NOT EXISTS idx_upload_trace_id ON public.upload(trace_id);
CREATE INDEX IF NOT EXISTS idx_debug_events_trace_id ON public.debug_events(trace_id);

-- 9. Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
