-- Drop existing policies
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON projects;
DROP POLICY IF EXISTS "projects_update_policy" ON projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON projects;

-- Grant necessary permissions first
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON projects TO authenticated;

-- Enable RLS on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create separate policies for each operation
-- SELECT policy - anyone can view projects
CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
TO authenticated
USING (true);

-- INSERT policy - project managers and admins can add projects
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

-- UPDATE policy - project managers and admins can update projects
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

-- DELETE policy - project managers and admins can delete projects
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