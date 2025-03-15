-- Drop existing policies for tasks table
DROP POLICY IF EXISTS "Allow read access to project members and admins" ON tasks;
DROP POLICY IF EXISTS "Allow insert for project members and admins" ON tasks;
DROP POLICY IF EXISTS "Allow update for assignee and admins" ON tasks;
DROP POLICY IF EXISTS "Allow delete for managers and admins" ON tasks;

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON tasks TO authenticated;

-- Policy to allow read access to project members and admins
CREATE POLICY "tasks_select_policy"
ON tasks FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM project_members WHERE project_id = tasks.project_id
    UNION
    SELECT id FROM users WHERE role = 'admin'
  )
);

-- Policy to allow insert for project members and admins
CREATE POLICY "tasks_insert_policy"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = project_id 
    AND user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy to allow update for task assignee, project members with manager role, and admins
CREATE POLICY "tasks_update_policy"
ON tasks FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
    UNION
    SELECT user_id FROM project_members 
    WHERE project_id = tasks.project_id 
    AND (role = 'manager' OR user_id = tasks.assigned_to)
  )
);

-- Policy to allow delete for project managers and admins
CREATE POLICY "tasks_delete_policy"
ON tasks FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE role = 'admin'
    UNION
    SELECT user_id FROM project_members 
    WHERE project_id = tasks.project_id AND role = 'manager'
  )
); 