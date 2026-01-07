-- Migration: Add progress tracking, stage, and confidence storage
-- Run this in Supabase SQL Editor

-- Upload progress tracking
alter table public.upload
  add column if not exists processing_stage text,
  add column if not exists progress integer default 0;

-- Store computed confidence details on extract
alter table public.statement_extract
  add column if not exists confidence jsonb;

-- Helpful index
create index if not exists idx_statement_extract_upload_id
  on public.statement_extract(upload_id);

