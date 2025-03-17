-- Script to fix Row Level Security (RLS) policies for the user-avatars bucket
-- Run this script in the Supabase SQL Editor

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Now recreate the policies with proper permissions

-- 1. Allow public read access for authenticated users
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-avatars');

-- 2. Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-avatars' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 3. Allow users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

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
    -- Create the bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'user-avatars',
      'user-avatars',
      true,
      2097152, -- 2MB
      ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    );
    RAISE NOTICE 'Created user-avatars bucket';
  ELSE
    RAISE NOTICE 'The user-avatars bucket exists';
  END IF;
END $$;

-- Helpful message
SELECT 'RLS policies for user-avatars bucket have been updated. The bucket is now:
1. Publicly readable
2. Allows authenticated users to upload/update/delete their own avatars
3. Has a 2MB file size limit
4. Only accepts image files (jpeg, png, gif, webp)' AS message; 