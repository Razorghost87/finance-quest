-- Enable RLS on storage.objects if not already (it usually is)
-- We need to handle the 'uploads' bucket.

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow Public Uploads (INSERT) to 'uploads' bucket
-- This is necessary because both Guests (anon) and Users (authenticated) need to upload.
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'uploads');

-- 3. Allow Public Downloads (SELECT) from 'uploads' bucket
-- Needed for the Edge Function (and potentially the client) to read the file.
CREATE POLICY "Allow public downloads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'uploads');

-- 4. Allow Public Updates/Deletes (optional, but good for cleanup/retries)
CREATE POLICY "Allow public updates"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'uploads');

CREATE POLICY "Allow public deletes"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'uploads');
