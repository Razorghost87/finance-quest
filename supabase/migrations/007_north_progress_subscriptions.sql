-- Migration: North Phase 1 - Progress fields, statement_extract, subscriptions
-- Run this in Supabase SQL Editor

-- 1.1 Add progress fields to upload table (if not already added)
alter table public.upload
  add column if not exists progress integer default 0,
  add column if not exists processing_stage text default 'starting',
  add column if not exists statement_extract_id uuid null;

-- Helpful indexes for upload table
create index if not exists upload_guest_token_idx on public.upload (guest_token);
create index if not exists upload_status_idx on public.upload (status);

-- 1.2 Create or extend statement_extract table
create table if not exists public.statement_extract (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.upload(id) on delete cascade,
  guest_token text not null,
  created_at timestamptz default now(),

  -- parsed transactions (normalized)
  transactions jsonb not null default '[]'::jsonb,

  -- derived free summary (what results.tsx consumes)
  free_summary jsonb not null default '{}'::jsonb,

  -- subscriptions (phase 1)
  subscriptions jsonb not null default '[]'::jsonb,

  -- confidence and reconciliation
  confidence jsonb not null default '{}'::jsonb,
  reconciliation jsonb not null default '{}'::jsonb,

  -- debug / metadata
  meta jsonb not null default '{}'::jsonb
);

-- Add columns if table exists but columns are missing
alter table public.statement_extract
  add column if not exists transactions jsonb not null default '[]'::jsonb,
  add column if not exists free_summary jsonb not null default '{}'::jsonb,
  add column if not exists subscriptions jsonb not null default '[]'::jsonb,
  add column if not exists confidence jsonb not null default '{}'::jsonb,
  add column if not exists reconciliation jsonb not null default '{}'::jsonb,
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Indexes for statement_extract
create index if not exists statement_extract_guest_token_idx on public.statement_extract (guest_token);
create index if not exists statement_extract_upload_id_idx on public.statement_extract (upload_id);

-- 1.3 Create subscription_items table (optional but recommended)
create table if not exists public.subscription_items (
  id uuid primary key default gen_random_uuid(),
  guest_token text not null,
  statement_extract_id uuid references public.statement_extract(id) on delete cascade,
  merchant text not null,
  normalized_merchant text not null,
  amount numeric not null,
  currency text default 'SGD',
  interval text not null, -- 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'unknown'
  last_seen_date date,
  next_expected_date date,
  confidence numeric not null default 0,
  source text not null default 'statement', -- statement | email | app_store
  user_confirmed boolean,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists subscription_items_guest_token_idx on public.subscription_items (guest_token);
create index if not exists subscription_items_statement_extract_id_idx on public.subscription_items (statement_extract_id);

-- Optional: debug log table for troubleshooting
create table if not exists public.debug_log (
  id bigserial primary key,
  created_at timestamptz default now(),
  guest_token text,
  upload_id uuid,
  scope text,
  message text,
  meta jsonb default '{}'::jsonb
);

create index if not exists debug_log_upload_id_idx on public.debug_log (upload_id);
create index if not exists debug_log_created_at_idx on public.debug_log (created_at);

