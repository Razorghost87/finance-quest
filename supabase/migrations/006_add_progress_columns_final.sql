-- Migration: Add progress tracking columns to upload table
-- Run this in Supabase SQL Editor

-- Add progress tracking columns
alter table public.upload
  add column if not exists progress numeric default 0,
  add column if not exists processing_stage text default 'starting',
  add column if not exists statement_extract_id uuid;

-- Optional: Set defaults for existing rows
update public.upload
set progress = 0, processing_stage = 'starting'
where progress is null;

-- Optional: Add constraint to ensure progress is 0-100
alter table public.upload
  add constraint upload_progress_range
  check (progress is null or (progress >= 0 and progress <= 100));

-- Optional: Add index for faster polling
create index if not exists idx_upload_guest_status
  on public.upload (guest_token, id, status);

-- Optional: Add foreign key constraint (if statement_extract table exists)
-- alter table public.upload
--   add constraint upload_statement_extract_fk
--   foreign key (statement_extract_id) references public.statement_extract(id)
--   on delete set null;

