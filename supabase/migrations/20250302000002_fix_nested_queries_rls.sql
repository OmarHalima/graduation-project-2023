-- Drop existing policies
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "project_members_select_policy" ON project_members;

-- Drop existing debug function
DROP FUNCTION IF EXISTS debug_auth();

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON projects TO authenticated;
GRANT ALL ON project_members TO authenticated;

-- Create policy to allow authenticated users to view all users
CREATE POLICY "users_select_policy"
ON users FOR SELECT
TO authenticated
USING (
  auth.role() = 'authenticated'
);

-- Create policy to allow authenticated users to view all projects
CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
TO authenticated
USING (
  auth.role() = 'authenticated'
);

-- Create policy to allow authenticated users to view project members
CREATE POLICY "project_members_select_policy"
ON project_members FOR SELECT
TO authenticated
USING (
  auth.role() = 'authenticated'
);

-- Add debugging function for auth claims
CREATE OR REPLACE FUNCTION debug_auth()
RETURNS TABLE (
  role text,
  uid uuid,
  email text,
  raw_claims jsonb
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT 
    auth.role()::text,
    auth.uid()::uuid,
    (current_setting('request.jwt.claims', true)::jsonb ->> 'email')::text,
    current_setting('request.jwt.claims', true)::jsonb;
END;
$$;

-- Grant execute permission on the debug function
GRANT EXECUTE ON FUNCTION debug_auth TO authenticated; 