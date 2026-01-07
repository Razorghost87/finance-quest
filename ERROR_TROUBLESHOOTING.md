# Error Troubleshooting Guide

## How to Share Error Logs

### 1. App-Side Errors (Expo/Metro)
**Where to find:**
- Terminal where you ran `npx expo start`
- Browser DevTools (if using web)
- React Native Debugger console

**What to copy:**
- The full error message
- Stack trace (if available)
- Any console.log lines before the error

**Example:**
```
❌ Upload failed: Failed to start parsing: Network error
    at uploadToSupabase (upload.tsx:123)
    at handleFileUpload (upload.tsx:456)
```

### 2. Edge Function Errors (Supabase)
**Where to find:**
1. Supabase Dashboard → Edge Functions → parse-statement → Logs
2. Or run: `supabase functions logs parse-statement --tail`

**What to copy:**
- The full error message
- Any console.error or console.warn lines
- The request body (upload_id, guest_token)

**Example:**
```
parse-statement invoked
Request body: { upload_id: 'abc-123', guest_token: 'xyz' }
Processing error: Error: OpenAI Responses failed 502: Bad Gateway
```

## Common Error Patterns

### Error: "column upload.progress does not exist"
**Fix:** Run the database migration:
```sql
-- Copy contents of supabase/migrations/004_add_progress_columns.sql
-- Run in Supabase SQL Editor
```

### Error: "502 Bad Gateway" or "OpenAI Responses failed 502"
**Status:** This is now handled with automatic retries (5 attempts with backoff)
**What to check:**
- Supabase Edge Function logs for retry attempts
- Should see: `⚠️ OpenAI retryable error 502 (attempt 1/5)`
- If all 5 attempts fail, check OpenAI API status

### Error: "Failed to download file" or "404 Not Found"
**Possible causes:**
1. File path mismatch between upload and storage
2. Storage bucket not configured correctly
3. File was deleted before processing

**Check:**
- Supabase Dashboard → Storage → uploads bucket
- Verify file exists with the path shown in logs
- Check `upload.file_path` in database matches storage object key

### Error: "Model did not return valid JSON"
**Status:** This is handled with robust JSON extraction
**What to check:**
- Edge Function logs for raw model output
- Look for `🔍 DEBUG:` lines showing extracted text
- May indicate OpenAI model issue or prompt problem

### Error: "Upload not found"
**Possible causes:**
1. upload_id doesn't exist in database
2. guest_token mismatch
3. RLS policy blocking access

**Check:**
- Supabase Dashboard → Table Editor → upload
- Verify upload record exists with matching id and guest_token
- Check RLS policies are correct

### Error: "Missing OPENAI_API_KEY"
**Fix:**
1. Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Set `OPENAI_API_KEY` secret
3. Redeploy function: `supabase functions deploy parse-statement`

### Error: "Processing service temporarily unavailable (502)"
**Status:** This is expected for transient failures
**What happens:**
- Edge Function automatically retries (5 times)
- Processing screen will show progress
- If all retries fail, error is shown with retry option

## Quick Diagnostic Commands

```bash
# Check Edge Function logs (last 50 lines)
supabase functions logs parse-statement --tail 50

# Check if function is deployed
supabase functions list

# Check database schema
# In Supabase Dashboard → SQL Editor, run:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'upload';
```

## Debug Mode

To get more detailed logs from the Edge Function:

1. In `app/(tabs)/upload.tsx`, the function is already called with `debug: true` (if you added it)
2. Check Edge Function logs for `debug_sample_text` in response
3. This shows the first 2000 chars of extracted text

## Still Stuck?

Share:
1. **Full error message** (copy-paste)
2. **Where it appears** (app console / Supabase logs / both)
3. **When it happens** (upload / processing / results)
4. **Recent changes** (what did you change before the error?)

Then I can provide a targeted fix!

