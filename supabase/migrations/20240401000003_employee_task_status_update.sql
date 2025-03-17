-- This migration adds an additional constraint to ensure employees can only update the status field of tasks assigned to them

-- First, create a function to restrict employee updates to only status field
CREATE OR REPLACE FUNCTION check_employee_task_update()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the role of the current user
  SELECT role INTO user_role FROM users WHERE id = auth.uid();
  
  -- If the user is an employee and trying to update their assigned task
  IF user_role = 'employee' AND NEW.assigned_to = auth.uid() THEN
    -- Check if any fields other than status are being updated
    IF (OLD.title != NEW.title) OR 
       (OLD.description IS DISTINCT FROM NEW.description) OR
       (OLD.priority != NEW.priority) OR
       (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) OR
       (OLD.due_date IS DISTINCT FROM NEW.due_date) OR
       (OLD.estimated_hours IS DISTINCT FROM NEW.estimated_hours) OR
       (OLD.phase_id IS DISTINCT FROM NEW.phase_id) THEN
      RAISE EXCEPTION 'Employees can only update the status of their assigned tasks';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to enforce this constraint
DROP TRIGGER IF EXISTS enforce_employee_task_update ON tasks;
CREATE TRIGGER enforce_employee_task_update
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION check_employee_task_update(); 