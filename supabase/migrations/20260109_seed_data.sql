-- 20260109_seed_data.sql
-- Helper function to seed data for a manually created user

create or replace function public.seed_test_data(target_email text, is_premium boolean default true)
returns text
language plpgsql
security definer
as $$
declare
  target_user_id uuid;
  hist_count int := 0;
begin
  -- 1. Find User
  select id into target_user_id from auth.users where email = target_email;
  
  if target_user_id is null then
    return 'Error: User ' || target_email || ' not found. Please Sign Up in the app first!';
  end if;

  -- 2. Set Profile
  insert into public.user_profiles (id, tier)
  values (target_user_id, case when is_premium then 'premium' else 'free' end)
  on conflict (id) do update
  set tier = excluded.tier;

  -- 3. Clear existing
  delete from public.north_star_metrics where user_id = target_user_id;
  delete from public.subscriptions where user_id = target_user_id;

  -- 4. Insert Data based on Persona
  if is_premium then
    -- "Alice" / Success Persona
    insert into public.north_star_metrics (user_id, period_end, net_cashflow, confidence_score) values
    (target_user_id, '2025-12-31', 1200, 0.95),
    (target_user_id, '2025-11-30', 850, 0.92),
    (target_user_id, '2025-10-31', 400, 0.88);
    
    insert into public.subscriptions (user_id, merchant_name, amount, interval, confidence_score) values
    (target_user_id, 'Netflix', 15.99, 'monthly', 0.99),
    (target_user_id, 'Spotify', 9.99, 'monthly', 0.99);
    
    return 'Success: Seeded Premium data for ' || target_email;
  else
    -- "Bob" / Drifting Persona
    insert into public.north_star_metrics (user_id, period_end, net_cashflow, confidence_score) values
    (target_user_id, '2025-12-31', -450, 0.65);
    
    insert into public.subscriptions (user_id, merchant_name, amount, interval, confidence_score) values
    (target_user_id, 'Unknown Service', 49.99, 'monthly', 0.40);
    
    return 'Success: Seeded Free/Drifting data for ' || target_email;
  end if;
end;
$$;
