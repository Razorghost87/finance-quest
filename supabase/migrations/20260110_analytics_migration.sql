-- Migration: Add Analytics & Traceability
-- Run this in Supabase SQL Editor

-- 1. Add 'category' to transaction_extract
ALTER TABLE public.transaction_extract
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Uncategorized';

-- 2. Add 'trace_id' to upload for observability
ALTER TABLE public.upload
  ADD COLUMN IF NOT EXISTS trace_id uuid;

-- 3. Fix: Ensure migrate_guest_data migrates categories too
-- (Use REPLACE to update existing function)
CREATE OR REPLACE FUNCTION public.migrate_guest_data(
  p_guest_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Update uploads
  UPDATE public.upload
  SET user_id = v_user_id,
      guest_token = NULL -- Clear guest token to "claim" it
  WHERE guest_token = p_guest_token;

  -- Update transaction_extract
  UPDATE public.transaction_extract
  SET user_id = v_user_id,
      guest_token = NULL
  WHERE guest_token = p_guest_token;

  -- Update statement_extract
  UPDATE public.statement_extract
  SET user_id = v_user_id,
      guest_token = NULL
  WHERE guest_token = p_guest_token;

END;
$$;
