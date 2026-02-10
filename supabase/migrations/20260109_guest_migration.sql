-- 20260109_guest_migration.sql
-- Function to migrate guest data to a signed-up user

create or replace function public.migrate_guest_data(guest_token_input text)
returns void
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
begin
  -- Get the ID of the currently authenticated user
  current_user_id := auth.uid();
  
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Migrate Statement Extracts
  update public.statement_extract
  set user_id = current_user_id
  where guest_token = guest_token_input
  and user_id is null;

  -- 2. Migrate Transactions
  -- (Note: transaction_extract usually doesn't have a direct user_id, 
  -- but relies on statement_extract. If you added user_id there, update it too.
  -- Assuming transaction_extract links via statement_extract_id, so no direct update needed unless specified)
  
  -- 3. Migrate Subscriptions
  update public.subscriptions
  set user_id = current_user_id
  where guest_token = guest_token_input
  and user_id is null;

  -- 4. Migrate North Star Metrics
  update public.north_star_metrics
  set user_id = current_user_id
  where guest_token = guest_token_input
  and user_id is null;

  -- 5. Create/Update Profile
  insert into public.user_profiles (id, tier)
  values (current_user_id, 'premium') -- Grant Premium trial/status upon unlocking
  on conflict (id) do update
  set tier = 'premium'; -- Upsert

end;
$$;
