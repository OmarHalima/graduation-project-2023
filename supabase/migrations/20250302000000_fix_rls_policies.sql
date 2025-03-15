-- Drop existing policies
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "projects_select_policy" ON projects;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON projects TO authenticated;

-- Create policy to allow authenticated users to view all users
CREATE POLICY "users_select_policy"
ON users FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to view all projects and related data
CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow authenticated users to view project members
CREATE POLICY "project_members_select_policy"
ON project_members FOR SELECT
TO authenticated
USING (true);

-- Grant additional permissions for related tables
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON projects TO authenticated;
GRANT SELECT ON project_members TO authenticated;