-- Script to fix the foreign key constraint in the tasks table
-- First, drop the existing foreign key constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_phase_id_fkey;

-- Then, add a new foreign key constraint that references project_phases
ALTER TABLE tasks ADD CONSTRAINT tasks_phase_id_fkey 
FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL;

-- Create a function to check if the constraint exists
CREATE OR REPLACE FUNCTION public.check_task_phase_fk()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  fk_exists BOOLEAN;
  fk_references TEXT;
BEGIN
  -- Check if the foreign key constraint exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_phase_id_fkey'
    AND table_name = 'tasks'
  ) INTO fk_exists;
  
  -- If it exists, check what table it references
  IF fk_exists THEN
    SELECT ccu.table_name 
    INTO fk_references
    FROM information_schema.constraint_column_usage ccu
    JOIN information_schema.table_constraints tc 
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_name = 'tasks_phase_id_fkey'
      AND tc.table_name = 'tasks';
  END IF;
  
  result := jsonb_build_object(
    'fk_exists', fk_exists,
    'fk_references', fk_references,
    'table_name', 'tasks',
    'constraint_name', 'tasks_phase_id_fkey'
  );
  
  RETURN result;
END;
$$; 