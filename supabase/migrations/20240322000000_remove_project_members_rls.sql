-- Drop all existing policies for project_members
DROP POLICY IF EXISTS "project_members_select_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_insert_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_update_policy" ON project_members;
DROP POLICY IF EXISTS "project_members_delete_policy" ON project_members;
DROP POLICY IF EXISTS "Allow select for project members and admins" ON project_members;
DROP POLICY IF EXISTS "Allow insert for project managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow update for project managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow delete for project managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow authenticated users to view project members" ON project_members;
DROP POLICY IF EXISTS "Allow project managers and admins to manage project members" ON project_members;
DROP POLICY IF EXISTS "Allow insert for managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow update for managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow delete for managers and admins" ON project_members;

-- Disable RLS on project_members table
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;

-- Grant full access to authenticated users
GRANT ALL ON project_members TO authenticated;

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_project_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_members_timestamp
    BEFORE UPDATE ON project_members
    FOR EACH ROW
    EXECUTE FUNCTION update_project_members_updated_at(); 