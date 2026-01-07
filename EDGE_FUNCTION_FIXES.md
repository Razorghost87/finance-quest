# Edge Function Fixes Applied

## Issues Fixed

### 1. ✅ Removed Node.js Dependencies
- **Removed**: `@supabase/supabase-js@2` import (was pulling in Node.js polyfills)
- **Replaced with**: Pure `fetch()`-based Supabase REST API calls
- **Result**: No more `Deno.core.runMicrotasks()` errors

### 2. ✅ Fixed Supabase Helper Functions
- **Query string building**: Now uses `URLSearchParams` for proper encoding
- **Storage signed URLs**: Fixed path encoding and response parsing
- **Storage downloads**: Fixed path encoding
- **Header merging**: Improved header handling in `supabaseFetch()`

### 3. ✅ Improved Error Handling
- All errors now return proper JSON responses (not HTML 502)
- Added try/catch around entire handler
- Better error messages with context

## Additional Actions You Should Take

### Step 1: Verify Environment Variables
Check that these are set in Supabase Edge Function secrets:

```bash
# Check current secrets
supabase secrets list

# If missing, set them:
supabase secrets set OPENAI_API_KEY=your_key_here
supabase secrets set SUPABASE_PROJECT_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_KEY=your_service_role_key_here
```

### Step 2: Test the Function Locally (Optional)
```bash
# Serve function locally
supabase functions serve parse-statement --no-verify-jwt

# Test with curl
curl -X POST http://localhost:54321/functions/v1/parse-statement \
  -H "Content-Type: application/json" \
  -d '{"upload_id": "test-id", "guest_token": "test-token"}'
```

### Step 3: Check Supabase Dashboard Logs
1. Go to: **Supabase Dashboard → Edge Functions → parse-statement → Logs**
2. Look for:
   - ✅ `parse-statement invoked` - Function started
   - ✅ `OPENAI_API_KEY present: true` - API key loaded
   - ✅ `📄 PDF DETECT` or `🖼️ Using image/vision OCR path` - Route selected
   - ❌ Any error messages with stack traces

### Step 4: Verify Database Tables Exist
Run this SQL in Supabase SQL Editor to verify tables:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('upload', 'statement_extract', 'transaction_extract', 'guest_session');
```

All 4 tables should exist.

### Step 5: Verify Storage Bucket
1. Go to: **Supabase Dashboard → Storage → Buckets**
2. Ensure `uploads` bucket exists
3. Check bucket is **Private** (not public)
4. Verify RLS policies allow service role access

### Step 6: Check Function Deployment
```bash
# Verify function is deployed
supabase functions list

# Should show: parse-statement
```

### Step 7: Test with a Simple Upload
1. Upload a single image (not PDF) first
2. Check logs for each step:
   - File upload to storage ✅
   - Database record created ✅
   - Function invoked ✅
   - OCR processing ✅
   - Results saved ✅

## Common Error Patterns

### Error: "Supabase API error 404"
- **Cause**: Table doesn't exist or wrong table name
- **Fix**: Run migrations: `supabase db reset` or check `supabase/migrations/`

### Error: "Supabase Storage download error 404"
- **Cause**: File path incorrect or bucket doesn't exist
- **Fix**: Verify `uploads` bucket exists and file was uploaded correctly

### Error: "OpenAI API error 401"
- **Cause**: Invalid or missing OpenAI API key
- **Fix**: Set `OPENAI_API_KEY` secret: `supabase secrets set OPENAI_API_KEY=sk-...`

### Error: "Failed to create signed URL"
- **Cause**: Storage bucket permissions or path encoding issue
- **Fix**: Check bucket exists and path is properly encoded (now fixed in code)

## Debugging Tips

1. **Enable debug mode**: Send `debug: true` in request body to get sample text
2. **Check logs in real-time**: Watch Supabase Dashboard logs while testing
3. **Test one route at a time**: Try PDF first, then images
4. **Check file sizes**: Very large files (>10MB) may timeout

## If Errors Persist

1. **Check function logs** in Supabase Dashboard for exact error messages
2. **Verify all secrets are set** correctly
3. **Test with minimal payload** (single small image)
4. **Check network connectivity** from Edge Function to OpenAI/Supabase

