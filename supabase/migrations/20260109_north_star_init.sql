-- 20260109_north_star_init.sql
-- Initialize North Star Financial Intelligence Tables

-- 1. PROFILES (Premium/Enterprise Tiering)
-- Extends auth.users with app-specific logic
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  tier text default 'free' check (tier in ('free', 'premium', 'enterprise')),
  north_star_config jsonb default '{"target_savings_rate": 0.2, "velocity_strategy": "aggressive"}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS for Profiles
alter table public.user_profiles enable row level security;
create policy "Users can view own profile" 
  on public.user_profiles for select 
  using (auth.uid() = id);
create policy "Users can update own profile" 
  on public.user_profiles for update 
  using (auth.uid() = id);

-- 2. SUBSCRIPTIONS (The "Drag" Metric)
-- Detected recurring payments
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  guest_token text, -- Support for Guest Mode initially
  merchant_name text not null,
  amount numeric not null,
  currency text default 'SGD',
  interval text default 'monthly', -- 'monthly', 'yearly', 'weekly'
  confidence_score float not null check (confidence_score >= 0 and confidence_score <= 1),
  status text default 'active' check (status in ('active', 'ignored', 'cancelled')),
  next_expected_date date,
  logo_url text, -- For UI polish
  created_at timestamptz default now()
);

-- RLS for Subscriptions (Hybrid Guest/User)
alter table public.subscriptions enable row level security;
create policy "Users can view own subscriptions" 
  on public.subscriptions for select 
  using (auth.uid() = user_id or guest_token = current_setting('request.headers')::json->>'x-guest-token');

-- 3. NORTH STAR METRICS (Trajectory History)
-- Snapshots of financial health over time
create table if not exists public.north_star_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  guest_token text,
  period_start date,
  period_end date,
  
  -- The Core Trajectory
  net_cashflow numeric,
  savings_velocity numeric, -- (Income - Expenses) / Income
  subscription_drag numeric, -- Fixed Costs / Income
  
  -- Confidence Meta-Layer
  confidence_score float check (confidence_score >= 0 and confidence_score <= 1),
  data_completeness float check (data_completeness >= 0 and data_completeness <= 1),
  
  insight_summary text, -- AI generated "You are moving North"
  created_at timestamptz default now()
);

-- RLS for Metrics
alter table public.north_star_metrics enable row level security;
create policy "Users can view own metrics" 
  on public.north_star_metrics for select 
  using (auth.uid() = user_id or guest_token = current_setting('request.headers')::json->>'x-guest-token');

-- 4. ENHANCE EXISTING TABLE (statement_extract)
-- Add columns for granular confidence if they don't exist
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'statement_extract' and column_name = 'confidence_score') then
    alter table public.statement_extract add column confidence_score float;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_name = 'statement_extract' and column_name = 'reconciliation_status') then
    alter table public.statement_extract add column reconciliation_status text check (reconciliation_status in ('verified', 'mismatch', 'partial'));
  end if;
end $$;
