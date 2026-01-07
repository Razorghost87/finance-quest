-- Migration: Add progress tracking, confidence, and reconciliation
-- Run this in Supabase SQL Editor or via migrations

-- 1) Upload progress tracking
alter table public.upload
  add column if not exists stage text,
  add column if not exists progress integer default 0,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

-- 2) Statement extract: store quality metrics
alter table public.statement_extract
  add column if not exists confidence_score numeric,
  add column if not exists reconciliation jsonb;

-- 3) Helpful index
create index if not exists idx_upload_guest_token_id on public.upload(guest_token, id);

-- 4) Optional: Add progress range constraint
alter table public.upload
  add constraint upload_progress_range_chk
  check (progress >= 0 and progress <= 100);

-- 5) Create RPC to get upload-specific free summary
create or replace function public.get_upload_free_summary(
  p_guest_token text,
  p_upload_id uuid
) returns jsonb
language sql
stable
as $$
  select coalesce(se.free_summary, '{}'::jsonb)
  from public.statement_extract se
  join public.upload u on u.id = se.upload_id
  where u.id = p_upload_id
    and u.guest_token = p_guest_token
  order by se.created_at desc
  limit 1;
$$;

