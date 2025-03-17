-- Drop existing policies for tasks table
DROP POLICY IF EXISTS "Allow read access to project members and admins" ON tasks;
DROP POLICY IF EXISTS "Allow insert for project members and admins" ON tasks;
DROP POLICY IF EXISTS "Allow update for assignee and admins" ON tasks;
DROP POLICY IF EXISTS "Allow delete for managers and admins" ON tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON tasks;

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

-- Policy to allow update for task assignee (only status), project members with manager role (all fields), and admins (all fields)
CREATE POLICY "tasks_update_policy"
ON tasks FOR UPDATE
TO authenticated
USING (
  (
    -- Admins can update all tasks
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  ) OR (
    -- Project managers can update all tasks in their projects
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = tasks.project_id 
      AND user_id = auth.uid()
      AND role = 'manager'
    )
  ) OR (
    -- Employees can only update status of tasks assigned to them
    tasks.assigned_to = auth.uid()
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