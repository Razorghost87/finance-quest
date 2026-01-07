-- Migration: Add progress tracking columns to upload table
-- Run this in Supabase SQL Editor
-- This is a simplified version that adds only the essential columns

-- Add progress tracking columns
alter table public.upload
  add column if not exists progress numeric default 0,
  add column if not exists processing_stage text default 'starting',
  add column if not exists statement_extract_id uuid;

-- Set defaults for existing rows (if any)
update public.upload
set progress = 0, processing_stage = 'starting'
where progress is null;

-- Add constraint to ensure progress is 0-100
alter table public.upload
  drop constraint if exists upload_progress_range;
  
alter table public.upload
  add constraint upload_progress_range
  check (progress is null or (progress >= 0 and progress <= 100));

-- Add index for faster polling
create index if not exists idx_upload_guest_status
  on public.upload (guest_token, id, status);

