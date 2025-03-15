-- Drop existing tables in correct order (dependencies first)
DROP TABLE IF EXISTS task_activities;
DROP TABLE IF EXISTS task_dependencies;
DROP TABLE IF EXISTS task_assignments;
DROP TABLE IF EXISTS task_attachments;
DROP TABLE IF EXISTS task_comments;
DROP TABLE IF EXISTS tasks;

-- Create tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'in_review', 'completed')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  due_date TIMESTAMP WITH TIME ZONE,
  estimated_hours NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access to project members and admins
CREATE POLICY "Allow read access to project members and admins" ON tasks
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = tasks.project_id
      UNION
      SELECT id FROM users WHERE role = 'admin'
    )
  );

-- Policy to allow insert for project members and admins
CREATE POLICY "Allow insert for project members and admins" ON tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = project_id
      UNION
      SELECT id FROM users WHERE role = 'admin'
    )
  );

-- Policy to allow update for task assignee, project members with manage permission, and admins
CREATE POLICY "Allow update for assignee and admins" ON tasks
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
      UNION
      SELECT user_id FROM project_members 
      WHERE project_id = tasks.project_id AND (role = 'manager' OR user_id = tasks.assigned_to)
    )
  );

-- Policy to allow delete for project managers and admins
CREATE POLICY "Allow delete for managers and admins" ON tasks
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
      UNION
      SELECT user_id FROM project_members 
      WHERE project_id = tasks.project_id AND role = 'manager'
    )
  );

-- Create task_activities table for tracking task history
CREATE TABLE task_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policies for task_activities
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access to project members and admins
CREATE POLICY "Allow read access to project members and admins" ON task_activities
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = (
        SELECT project_id FROM tasks WHERE id = task_activities.task_id
      )
      UNION
      SELECT id FROM users WHERE role = 'admin'
    )
  );

-- Policy to allow insert for project members and admins
CREATE POLICY "Allow insert for project members and admins" ON task_activities
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = (
        SELECT project_id FROM tasks WHERE id = task_id
      )
      UNION
      SELECT id FROM users WHERE role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 