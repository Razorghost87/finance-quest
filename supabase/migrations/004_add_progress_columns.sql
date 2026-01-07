-- Migration: Add progress tracking columns to upload table
-- Run this in Supabase SQL Editor

-- 1) Add columns used by ProcessingScreen progress + stage + linking extract
alter table public.upload
  add column if not exists progress double precision,
  add column if not exists processing_stage text,
  add column if not exists statement_extract_id uuid,
  add column if not exists attempt_count int default 0,
  add column if not exists next_retry_at timestamptz null,
  add column if not exists last_error text null;

-- 2) Optional: constrain progress range
alter table public.upload
  add constraint if not exists upload_progress_range
  check (progress is null or (progress >= 0 and progress <= 100));

-- 3) Optional: index for faster polling
create index if not exists idx_upload_guest_status
  on public.upload (guest_token, id, status);

create index if not exists idx_upload_next_retry on public.upload(next_retry_at);

-- optional but recommended for debugging
alter table public.upload
  add column if not exists updated_at timestamptz default now();

create or replace function public.touch_upload_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_upload_updated_at on public.upload;
create trigger trg_upload_updated_at
before update on public.upload
for each row execute function public.touch_upload_updated_at();

-- Optional: FK constraint if statement_extract table exists
-- Uncomment if you want referential integrity:
-- alter table public.upload
--   add constraint if not exists upload_statement_extract_fk
--   foreign key (statement_extract_id) references public.statement_extract(id)
--   on delete set null;

