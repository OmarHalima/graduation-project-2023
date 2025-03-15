# Supabase Row Level Security (RLS) Guide

This directory contains information and scripts to help you set up and debug Row Level Security (RLS) policies in your Supabase project.

## What is Row Level Security?

Row Level Security (RLS) is a feature that allows you to control access to rows in a database table based on a user's role or attributes. With RLS enabled on a table, all queries to that table will be filtered according to the defined policies.

## Common RLS-Related Errors

When working with Supabase, you might encounter these common RLS-related errors:

1. **"new row violates row-level security policy"**: This occurs when you try to perform an operation (INSERT, UPDATE, DELETE) that is not allowed by the RLS policies.

2. **"permission denied for table"**: This happens when RLS is enabled but no policies are defined for the operation you're trying to perform.

3. **"Cannot find storage bucket"**: This occurs when trying to access a storage bucket that doesn't exist or the user doesn't have permission to access.

## Debugging RLS Issues

We've created a set of tools to help you diagnose and fix RLS issues:

1. **RLS Debugger Component**: In development mode, go to the Settings page to access the RLS Policy Debugger. This tool runs various tests to identify issues with your RLS policies.

2. **supabaseRlsCheck.ts**: This utility file contains functions to diagnose RLS issues programmatically.

3. **rls_policies.sql**: This file contains recommended RLS policies for your project's tables and storage buckets.

## How to Fix RLS Issues

### Step 1: Enable RLS on Your Tables

```sql
ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;
```

### Step 2: Create Appropriate Policies

For each table, create policies for different operations (SELECT, INSERT, UPDATE, DELETE) based on your requirements.

Example for the 'users' table:

```sql
-- Allow users to view all users
CREATE POLICY "Users can view all users" 
ON users 
FOR SELECT 
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON users 
FOR UPDATE 
USING (auth.uid() = id);
```

### Step 3: Set Up Storage Bucket Policies

For storage buckets like 'user-avatars', you need policies for file operations:

```sql
-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');
```

### Step 4: Test Your Policies

After setting up policies, test them by:

1. Logging in as different users with different roles
2. Trying operations that should be allowed/disallowed
3. Using the RLS Debugger component

## Troubleshooting Specific Issues

### Avatar Upload Issues

If you're having issues with avatar uploads:

1. Check if the 'user-avatars' bucket exists
2. Ensure the bucket has the right policies for INSERT operations
3. Verify that the user table has proper UPDATE policies to allow updating the avatar_url field

### Dashboard Data Issues

If your dashboard data isn't loading:

1. Check if the activities and projects tables have SELECT policies
2. Verify that the user has the necessary permissions based on their role

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase Storage Policies](https://supabase.com/docs/guides/storage/security) 