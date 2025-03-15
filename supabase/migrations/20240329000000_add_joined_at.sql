-- Add joined_at column to project_members table
ALTER TABLE project_members
ADD COLUMN joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- Update existing rows to have joined_at set to their created_at value
UPDATE project_members
SET joined_at = created_at
WHERE joined_at IS NULL; 