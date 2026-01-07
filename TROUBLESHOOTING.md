# Troubleshooting Upload Errors

## Quick Checklist

### 1. Check Supabase Configuration
```bash
# Make sure .env file exists and has values
cat .env
```

Should show:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Check Storage Bucket
- Go to Supabase Dashboard → Storage
- Verify `uploads` bucket exists
- Make sure it's **private** (not public)

### 3. Check Database Tables
- Go to Supabase Dashboard → Table Editor
- Verify these tables exist:
  - `guest_session`
  - `upload`
  - `statement_extract`
  - `transaction_extract`

### 4. Check Edge Function
- Go to Supabase Dashboard → Edge Functions
- Verify `parse-statement` function exists
- Check Logs tab for errors

### 5. Check Console Logs

When you upload, look for these in your terminal:

**Success flow:**
```
📤 Starting upload process...
✅ Supabase client configured
✅ Guest token: guest_...
📖 Reading file from URI...
✅ File read successfully
🔄 Converting base64 to ArrayBuffer...
✅ Converted to ArrayBuffer
📦 Uploading to storage bucket "uploads"...
✅ File uploaded to storage
💾 Creating upload record in database...
✅ Upload record created
🚀 Invoking parse-statement edge function...
```

**If you see ❌ at any step, that's where it failed!**

## Common Error Messages

### "Supabase is not configured"
- **Fix:** Create `.env` file with your Supabase credentials
- See `SUPABASE_SETUP.md` for details

### "Storage upload failed"
- **Fix:** Make sure `uploads` bucket exists in Supabase Storage
- Check bucket is private (not public)

### "Failed to create upload record"
- **Fix:** Run the database migration SQL
- Check `supabase/migrations/001_initial_schema.sql`

### "Failed to start parsing" or Edge Function errors
- **Fix:** Check Supabase Dashboard → Edge Functions → parse-statement → Logs
- Verify function is deployed
- Check `OPENAI_API_KEY` secret is set

### File read errors
- **Fix:** Make sure you're selecting a valid PDF or image file
- Try a different file

## How to See Full Error Details

1. **In the app:** When error alert appears, tap "Copy Error" button
2. **In terminal:** Look for the `═══════════════════════════════════════` section
3. **In Supabase:** Check Edge Functions → parse-statement → Logs

## Still Having Issues?

1. Check the terminal where `npm start` is running
2. Look for the ❌ emoji - that shows which step failed
3. Copy the full error message
4. Check Supabase Dashboard logs for edge function errors

