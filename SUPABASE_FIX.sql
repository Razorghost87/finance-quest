-- Migration Fix: Add missing columns and tables
-- Copy and run this ENTIRE block in your Supabase SQL Editor

-- 1. Add missing columns to 'upload' table
ALTER TABLE public.upload
  ADD COLUMN IF NOT EXISTS progress double precision,
  ADD COLUMN IF NOT EXISTS processing_stage text,
  ADD COLUMN IF NOT EXISTS statement_extract_id uuid,
  ADD COLUMN IF NOT EXISTS attempt_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_error text NULL;

-- 2. Add 'jobs' table for background processing
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.upload(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'error')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS jobs_upload_id_idx ON public.jobs(upload_id);
CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON public.jobs(status, created_at);

-- 4. Enable RLS on jobs (optional but good practice)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow jobs access" ON public.jobs
  FOR ALL USING (true) WITH CHECK (true);
