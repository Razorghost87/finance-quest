# Debugging Guide - Where to Find Error Logs

## Console Logs Location

### Option 1: Expo Dev Tools (Recommended)
1. When you run `npm start`, Expo opens in your browser
2. Look at the terminal where you ran `npm start` - logs appear there
3. Press `j` to open the debugger in your browser
4. Open browser DevTools (F12) → Console tab to see all logs

### Option 2: React Native Debugger
1. Shake your device (or press `Cmd+D` on iOS simulator / `Cmd+M` on Android)
2. Select "Debug" or "Open Debugger"
3. This opens Chrome DevTools
4. Check the Console tab for all `console.log` and `console.error` statements

### Option 3: Metro Bundler Terminal
- The terminal where you ran `npm start` shows all console logs
- Look for lines starting with `❌` for errors
- Look for `FUNCTION INVOKE FAILED` for edge function errors

### Option 4: Supabase Dashboard (For Edge Function Logs)
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **Edge Functions** in the left sidebar
4. Click **parse-statement**
5. Click **Logs** tab
6. You'll see all `console.log` statements from the edge function

## What to Look For

### In App Console:
- `❌ FUNCTION INVOKE FAILED` - Edge function call failed
- `❌ UPLOAD ERROR` - File upload failed
- `❌ HANDLE FILE UPLOAD ERROR` - Upload handler error

### In Supabase Edge Function Logs:
- `parse-statement invoked` - Function was called
- `Request body: { upload_id, guest_token }` - Request received
- `OPENAI_API_KEY present: true/false` - API key status
- `Processing error:` - Error during processing

## Common Issues

### Logs Not Showing in Terminal
- Make sure you're looking at the terminal where `npm start` is running
- Try pressing `r` in the Expo terminal to reload
- Check if you're using Expo Go (logs might be in different location)

### Edge Function Errors Not Visible
- Check Supabase Dashboard → Edge Functions → parse-statement → Logs
- The function logs are separate from app logs
- Look for errors with status codes (400, 404, 500)

### Error Details in App
- The app now shows error details in Alert dialogs
- Tap "View Details" button to see full error message
- Check the console for full error objects

## Quick Debug Commands

```bash
# View Supabase function logs
supabase functions logs parse-statement

# View recent logs with timestamps
supabase functions logs parse-statement --tail

# Check function deployment
supabase functions list
```

## Testing Error Visibility

1. **Upload a file** - Watch the terminal for logs
2. **Check browser console** - If using web, open DevTools
3. **Check Supabase dashboard** - For edge function logs
4. **Check app alerts** - Error messages appear in Alert dialogs

