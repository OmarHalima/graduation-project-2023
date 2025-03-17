-- Function to check and fix the foreign key reference between tasks and project_phases tables
CREATE OR REPLACE FUNCTION public.check_task_phase_fk()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  fk_exists BOOLEAN;
BEGIN
  -- Check if the foreign key constraint exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_phase_id_fkey'
    AND table_name = 'tasks'
  ) INTO fk_exists;
  
  result := jsonb_build_object(
    'fk_exists', fk_exists,
    'table_name', 'tasks',
    'constraint_name', 'tasks_phase_id_fkey'
  );
  
  RETURN result;
END;
$$; 