-- Add created_by column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add created_at column if it doesn't exist (for completeness)
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Update the projects table permissions
GRANT ALL ON projects TO authenticated;

-- Create policy for inserting projects with created_by
CREATE POLICY "projects_insert_with_created_by_policy"
ON projects FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);

-- Create policy for updating own projects
CREATE POLICY "projects_update_own_policy"
ON projects FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by OR
  auth.uid() = owner_id OR
  auth.uid() = manager_id OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'project_manager')
  )
); 