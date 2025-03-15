-- Drop ALL existing policies for project_members
DROP POLICY IF EXISTS "Allow select for project members and admins" ON project_members;
DROP POLICY IF EXISTS "Allow insert for project managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow update for project managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow delete for project managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow authenticated users to view project members" ON project_members;
DROP POLICY IF EXISTS "Allow project managers and admins to manage project members" ON project_members;
DROP POLICY IF EXISTS "Allow insert for managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow update for managers and admins" ON project_members;
DROP POLICY IF EXISTS "Allow delete for managers and admins" ON project_members;

-- Grant necessary permissions first
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON project_members TO authenticated;
GRANT SELECT ON users TO authenticated;

-- Enable RLS on project_members table
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Create separate policies for each operation
-- SELECT policy - anyone can view project members
CREATE POLICY "project_members_select_policy"
ON project_members FOR SELECT
TO authenticated
USING (true);

-- INSERT policy - project managers and admins can add members
CREATE POLICY "project_members_insert_policy"
ON project_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'project_manager')
  )
);

-- UPDATE policy - project managers and admins can update members
CREATE POLICY "project_members_update_policy"
ON project_members FOR UPDATE
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

-- DELETE policy - project managers and admins can remove members
CREATE POLICY "project_members_delete_policy"
ON project_members FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'project_manager')
  )
); 