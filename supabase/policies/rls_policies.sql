-- This SQL file contains recommend Row Level Security policies for your Supabase project
-- Run this in the Supabase SQL Editor

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- =====================================
-- USERS TABLE POLICIES
-- =====================================

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

-- =====================================
-- ACTIVITIES TABLE POLICIES
-- =====================================

-- Allow everyone to view activities
CREATE POLICY "Everyone can view activities" 
ON activities 
FOR SELECT 
USING (true);

-- Allow authenticated users to create activities
CREATE POLICY "Authenticated users can create activities" 
ON activities 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- =====================================
-- PROJECTS TABLE POLICIES
-- =====================================

-- Allow users to view all projects
CREATE POLICY "Users can view all projects" 
ON projects 
FOR SELECT 
USING (true);

-- Allow project managers to create new projects
CREATE POLICY "Project managers can create projects" 
ON projects 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM users WHERE role = 'project_manager' OR role = 'admin'
  )
);

-- Allow project managers to update their projects
CREATE POLICY "Project managers can update their projects" 
ON projects 
FOR UPDATE 
USING (
  auth.uid() = manager_id OR 
  auth.uid() = owner_id OR
  auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
  )
);

-- =====================================
-- PROJECT_MEMBERS TABLE POLICIES
-- =====================================

-- Allow users to view project members
CREATE POLICY "Users can view project members" 
ON project_members 
FOR SELECT 
USING (true);

-- Allow project managers to add project members
CREATE POLICY "Project managers can add project members" 
ON project_members 
FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT manager_id FROM projects WHERE id = project_id
  ) OR
  auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
  )
);

-- =====================================
-- STORAGE BUCKET POLICIES
-- =====================================

-- For user-avatars bucket:
-- 1. First make sure the bucket exists
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

-- =====================================
-- TEST YOUR POLICIES
-- =====================================
-- After setting up these policies, test them by:
-- 1. Logging in as different users with different roles
-- 2. Trying to perform operations that should be allowed/disallowed
-- 3. Using the RLS Debugger component in development mode 