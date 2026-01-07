# Supabase Setup Guide

This guide will walk you through setting up Supabase for the Finance Quest app step-by-step.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- An OpenAI API key (get one at https://platform.openai.com/api-keys)

## Step 1: Create a Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in:
   - **Name**: finance-quest (or any name you prefer)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait 2-3 minutes for the project to be created

## Step 2: Get Your Project Credentials

1. In your Supabase project dashboard, click the **Settings** icon (gear) in the left sidebar
2. Click **API** in the settings menu
3. You'll see:
   - **Project URL**: Copy this (you'll need it for `EXPO_PUBLIC_SUPABASE_URL`)
   - **anon public** key: Copy this (you'll need it for `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
4. Keep this tab open - you'll need these values later

## Step 3: Create Storage Bucket

1. In your Supabase dashboard, click **Storage** in the left sidebar
2. Click **New bucket**
3. Fill in:
   - **Name**: `uploads`
   - **Public bucket**: **Uncheck this** (keep it private)
4. Click **Create bucket**
5. The bucket is now ready to store uploaded files

## Step 4: Run Database Migrations

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste it into the SQL editor
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned"
7. Verify tables were created:
   - Click **Table Editor** in the left sidebar
   - You should see: `guest_session`, `upload`, `statement_extract`, `transaction_extract`

## Step 5: Fix RLS Policies (Important!)

The initial migration uses session variables which don't work directly. We need to update the RLS policies:

1. Go back to **SQL Editor**
2. Run this SQL to update the policies:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Guests can read their own session" ON guest_session;
DROP POLICY IF EXISTS "Guests can insert their own session" ON guest_session;
DROP POLICY IF EXISTS "Guests can update their own session" ON guest_session;
DROP POLICY IF EXISTS "Guests can read their own uploads" ON upload;
DROP POLICY IF EXISTS "Guests can insert their own uploads" ON upload;
DROP POLICY IF EXISTS "Guests can update their own uploads" ON upload;
DROP POLICY IF EXISTS "Guests can read their own extracts" ON statement_extract;
DROP POLICY IF EXISTS "Guests can read their own transactions" ON transaction_extract;

-- Create new policies that work with service role
-- For guest_session: allow all for now (will be restricted by app logic)
CREATE POLICY "Allow guest session access" ON guest_session
  FOR ALL USING (true) WITH CHECK (true);

-- For upload: allow all for now (will be restricted by app logic)
CREATE POLICY "Allow upload access" ON upload
  FOR ALL USING (true) WITH CHECK (true);

-- For statement_extract: allow all for now
CREATE POLICY "Allow statement extract access" ON statement_extract
  FOR ALL USING (true) WITH CHECK (true);

-- For transaction_extract: allow all for now
CREATE POLICY "Allow transaction extract access" ON transaction_extract
  FOR ALL USING (true) WITH CHECK (true);
```

3. Click **Run**

## Step 6: Deploy Edge Function

### Option A: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Find your project ref in Settings > General > Reference ID)

4. Deploy the function:
   ```bash
   supabase functions deploy parse-statement
   ```

### Option B: Using Supabase Dashboard

1. In your Supabase dashboard, click **Edge Functions** in the left sidebar
2. Click **Create a new function**
3. Name it: `parse-statement`
4. Copy the contents of `supabase/functions/parse-statement/index.ts`
5. Paste into the editor
6. Click **Deploy**

## Step 7: Set OpenAI API Key as Secret

1. In your Supabase dashboard, go to **Edge Functions**
2. Click on **parse-statement** function
3. Click **Settings** tab
4. Under **Secrets**, click **Add secret**
5. Enter:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key
6. Click **Save**

Alternatively, using CLI:
```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

## Step 8: Configure Your App

1. In your project root, create a `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your values:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Save the file

## Step 9: Install Dependencies

```bash
npm install
```

## Step 10: Test the Setup

1. Start your app:
   ```bash
   npm start
   ```

2. Try uploading a statement:
   - The upload should work
   - Processing should start
   - Results should appear after parsing

## Troubleshooting

### "Supabase is not configured" error
- Check that `.env` file exists and has correct values
- Restart your Expo dev server after changing `.env`

### "Upload failed" error
- Check that the `uploads` bucket exists and is private
- Verify your Supabase credentials are correct

### "Processing failed" error
- Check that the Edge Function is deployed
- Verify `OPENAI_API_KEY` secret is set
- Check Edge Function logs in Supabase dashboard

### RLS Policy errors
- Make sure you ran the RLS policy fix SQL (Step 5)
- For development, you can temporarily disable RLS on tables if needed

## Next Steps

- Set up proper RLS policies for production
- Add authentication for registered users
- Implement payment processing for North Plus

