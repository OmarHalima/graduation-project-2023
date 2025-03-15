-- Script to fix Row Level Security (RLS) policies for the user-avatars bucket
-- Run this script in the Supabase SQL Editor

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Now recreate the policies with proper permissions

-- 1. Allow authenticated users to read avatars
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');

-- 2. Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');

-- 3. Allow users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');

-- 4. Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');

-- Verify bucket configuration
DO $$
DECLARE 
  bucket_exists BOOLEAN;
BEGIN
  -- Check if bucket exists
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'user-avatars'
  ) INTO bucket_exists;
  
  IF NOT bucket_exists THEN
    RAISE NOTICE 'The user-avatars bucket does not exist. Create it using the Supabase dashboard or API.';
  ELSE
    RAISE NOTICE 'The user-avatars bucket exists.';
  END IF;
END $$;

-- Helpful message
SELECT 'RLS policies for user-avatars bucket have been set up. Remember that the bucket must be configured to only accept the following MIME types: image/jpeg, image/png, image/gif, image/webp' AS message; 