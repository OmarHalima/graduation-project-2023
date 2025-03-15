-- Drop existing policies
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON projects;
DROP POLICY IF EXISTS "projects_update_policy" ON projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON projects;

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON projects TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON project_members TO authenticated;

-- Create policy to allow authenticated users to view all projects
CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
TO authenticated
USING (
  -- Debug info
  coalesce(
    current_setting('request.jwt.claims', true)::json->>'role',
    'no_role'
  ) = 'authenticated'
  AND
  coalesce(
    current_setting('request.jwt.claims', true)::json->>'sub',
    'no_sub'
  ) IS NOT NULL
);

-- Create policy to allow project managers and admins to create projects
CREATE POLICY "projects_insert_policy"
ON projects FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'project_manager')
  )
);

-- Create policy to allow project managers and admins to update projects
CREATE POLICY "projects_update_policy"
ON projects FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'project_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'project_manager')
  )
);

-- Create policy to allow project managers and admins to delete projects
CREATE POLICY "projects_delete_policy"
ON projects FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'project_manager')
  )
);

-- Create policy to allow authenticated users to view all users
CREATE POLICY "users_select_policy"
ON users FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to view project members
CREATE POLICY "project_members_select_policy"
ON project_members FOR SELECT
TO authenticated
USING (true);

-- Add debugging function
CREATE OR REPLACE FUNCTION debug_auth()
RETURNS TABLE (
  setting_name text,
  setting_value text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 'role'::text, coalesce(current_setting('request.jwt.claims', true)::json->>'role', 'no_role')
  UNION ALL
  SELECT 'sub'::text, coalesce(current_setting('request.jwt.claims', true)::json->>'sub', 'no_sub')
  UNION ALL
  SELECT 'email'::text, coalesce(current_setting('request.jwt.claims', true)::json->>'email', 'no_email');
END;
$$; 