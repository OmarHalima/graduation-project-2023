-- Remove the RLS constraint for insert
DROP POLICY IF EXISTS "Project managers can insert phases" ON phases;

-- Create a new policy that allows insertion from the NewTaskModal context
CREATE POLICY "Tasks can insert into phases" 
ON phases 
FOR INSERT 
TO public 
WITH CHECK (
  project_id IN (
    SELECT projects.id
    FROM projects
    JOIN project_members ON projects.id = project_members.project_id
    WHERE project_members.user_id = auth.uid()
  )
); 
