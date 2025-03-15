# Setting Up Supabase Storage Policies

The error you're seeing (`TypeError: supabaseAdmin.storage.from(...).createPolicy is not a function`) occurs because the Supabase JavaScript client doesn't provide a method to create storage policies programmatically.

## How to Set Up Storage Policies

### Option 1: Using the Supabase Dashboard (Recommended for beginners)

1. Go to your Supabase dashboard
2. Navigate to "Storage" in the left sidebar
3. Select the "user-avatars" bucket
4. Click on "Policies" tab
5. Add the following policies:

   a. **Allow public read access**:
   - Description: "Allow public read access"
   - Policy definition: `bucket_id = 'user-avatars' AND auth.role() = 'authenticated'`
   - Operations: SELECT

   b. **Allow authenticated users to upload avatars**:
   - Description: "Allow authenticated users to upload avatars"
   - Policy definition: `bucket_id = 'user-avatars' AND auth.role() = 'authenticated'`
   - Operations: INSERT

   c. **Allow users to update their avatars**:
   - Description: "Allow users to update their avatars" 
   - Policy definition: `bucket_id = 'user-avatars' AND auth.role() = 'authenticated'`
   - Operations: UPDATE

   d. **Allow users to delete their avatars**:
   - Description: "Allow users to delete their avatars"
   - Policy definition: `bucket_id = 'user-avatars' AND auth.role() = 'authenticated'`
   - Operations: DELETE

### Option 2: Using SQL

1. Go to your Supabase dashboard
2. Navigate to "SQL Editor" in the left sidebar
3. Create a new query
4. Copy and paste the following SQL:

```sql
-- For user-avatars bucket:
-- Allow authenticated users to read avatars
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');

-- Allow users to update their own avatars
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');
```

5. Click "Run" to execute the SQL

### Option 3: Run the Complete RLS Policy Script

For a more comprehensive setup including table policies and storage policies:

1. Go to your Supabase dashboard
2. Navigate to "SQL Editor" in the left sidebar
3. Create a new query
4. Open the file `supabase/policies/rls_policies.sql` in your project
5. Copy and paste the entire contents into the SQL Editor
6. Click "Run" to execute the SQL

## Troubleshooting

If you're still seeing RLS errors after setting up the policies:

1. Try running the RLS Debugger (available in development mode on the Settings page)
2. Make sure Row Level Security is enabled for all tables
3. Check the user authentication is working correctly
4. Verify the storage bucket exists and has the correct name "user-avatars" 