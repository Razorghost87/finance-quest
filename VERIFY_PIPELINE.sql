-- ============================================================
-- PIPELINE VERIFICATION SCRIPT
-- Run in Supabase SQL Editor
-- https://supabase.com/dashboard/project/mlraxwphcjrfjzfojetq/sql
-- ============================================================

-- ============================================================
-- STEP 1: Verify table columns exist
-- ============================================================

-- 1A. Upload table columns
SELECT '=== UPLOAD TABLE COLUMNS ===' as section;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'upload'
ORDER BY ordinal_position;

-- 1B. Jobs table columns
SELECT '=== JOBS TABLE COLUMNS ===' as section;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jobs'
ORDER BY ordinal_position;

-- 1C. Statement extract columns
SELECT '=== STATEMENT_EXTRACT TABLE COLUMNS ===' as section;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'statement_extract'
ORDER BY ordinal_position;

-- 1D. Transaction extract columns
SELECT '=== TRANSACTION_EXTRACT TABLE COLUMNS ===' as section;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transaction_extract'
ORDER BY ordinal_position;

-- 1E. Debug events columns
SELECT '=== DEBUG_EVENTS TABLE COLUMNS ===' as section;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'debug_events'
ORDER BY ordinal_position;

-- ============================================================
-- STEP 2: Check recent jobs
-- ============================================================
SELECT '=== RECENT JOBS ===' as section;
SELECT 
  id as job_id, 
  upload_id, 
  status, 
  attempts, 
  last_error,
  created_at
FROM jobs
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- STEP 3: Check upload status progression
-- ============================================================
SELECT '=== RECENT UPLOADS ===' as section;
SELECT 
  id as upload_id,
  file_name,
  status,
  progress,
  processing_stage,
  statement_extract_id,
  error_message,
  trace_id,
  created_at
FROM upload
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- STEP 4: Check statement extracts
-- ============================================================
SELECT '=== RECENT STATEMENT EXTRACTS ===' as section;
SELECT 
  id,
  upload_id,
  guest_token,
  free_summary->>'period' as period,
  (free_summary->'totals'->>'inflow')::numeric as inflow,
  (free_summary->'totals'->>'outflow')::numeric as outflow,
  (free_summary->'totals'->>'netCashflow')::numeric as net,
  created_at
FROM statement_extract
ORDER BY created_at DESC
LIMIT 3;

-- ============================================================
-- STEP 5: Check transaction counts per upload
-- ============================================================
SELECT '=== TRANSACTION COUNTS ===' as section;
SELECT 
  upload_id,
  COUNT(*) as tx_count,
  MAX(created_at) as latest_tx
FROM transaction_extract
GROUP BY upload_id
ORDER BY MAX(created_at) DESC
LIMIT 5;

-- ============================================================
-- STEP 6: Check debug events (trace to see what happened)
-- ============================================================
SELECT '=== RECENT DEBUG EVENTS ===' as section;
SELECT 
  trace_id,
  source,
  level,
  message,
  created_at
FROM debug_events
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================
-- STEP 7: Verify RPC function exists
-- ============================================================
SELECT '=== RPC FUNCTION CHECK ===' as section;
SELECT proname as function_name
FROM pg_proc
WHERE proname IN ('get_guest_free_summary', 'can_guest_upload', 'mark_guest_used');

-- ============================================================
-- DIAGNOSIS HELPER: Find stuck uploads
-- ============================================================
SELECT '=== STUCK UPLOADS (processing > 5 min) ===' as section;
SELECT 
  id,
  status,
  processing_stage,
  progress,
  error_message,
  trace_id,
  created_at,
  NOW() - created_at as age
FROM upload
WHERE status = 'processing' 
  AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- ============================================================
-- DIAGNOSIS HELPER: Failed jobs
-- ============================================================
SELECT '=== FAILED JOBS ===' as section;
SELECT 
  j.id as job_id,
  j.upload_id,
  j.status,
  j.last_error,
  u.file_name,
  u.trace_id
FROM jobs j
JOIN upload u ON u.id = j.upload_id
WHERE j.status = 'error'
ORDER BY j.created_at DESC
LIMIT 5;
