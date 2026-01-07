-- Migration: Add jobs table for async processing
-- Run this in Supabase SQL Editor

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.upload(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'error')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_upload_id_idx on public.jobs(upload_id);
create index if not exists jobs_status_created_idx on public.jobs(status, created_at);

-- Auto-update updated_at
create or replace function public.touch_job_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_job_updated_at on public.jobs;
create trigger trg_job_updated_at
before update on public.jobs
for each row execute function public.touch_job_updated_at();

