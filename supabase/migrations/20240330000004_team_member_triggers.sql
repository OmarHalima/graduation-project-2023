-- Create a function to handle team member removal
CREATE OR REPLACE FUNCTION handle_team_member_removal()
RETURNS TRIGGER AS $$
DECLARE
  member_name TEXT;
BEGIN
  -- Try to get user info from public.users first
  SELECT full_name INTO member_name
  FROM public.users
  WHERE id = OLD.user_id;

  -- If no name found, use a generic identifier
  IF member_name IS NULL THEN
    member_name := 'User ' || OLD.user_id::text;
  END IF;

  -- Update the left_at timestamp
  UPDATE team_member_records
  SET left_at = NOW()
  WHERE project_id = OLD.project_id
  AND user_id = OLD.user_id;

  -- Archive the member's document with safe naming
  UPDATE project_documents
  SET title = '[ARCHIVED] Team Member: ' || member_name,
      updated_at = NOW()
  WHERE project_id = OLD.project_id
  AND (
    title LIKE 'Team Member Profile: ' || member_name
    OR title LIKE 'Team Member Profile: %'
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS team_member_removal_trigger ON project_members;

-- Create the trigger
CREATE TRIGGER team_member_removal_trigger
  AFTER DELETE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_team_member_removal();

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_team_member_records_project_user
ON team_member_records (project_id, user_id); 