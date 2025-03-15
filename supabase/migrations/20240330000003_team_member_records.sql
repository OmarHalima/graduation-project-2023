-- Create team member records table
CREATE TABLE team_member_records (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    department TEXT,
    position TEXT,
    cv_data JSONB,
    past_projects JSONB,
    interview_notes TEXT,
    additional_notes TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    left_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create index for better performance
CREATE INDEX idx_team_member_records_project_user ON team_member_records(project_id, user_id);

-- Enable RLS
ALTER TABLE team_member_records ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON team_member_records TO authenticated;

-- RLS Policies
CREATE POLICY "Users can view team member records"
    ON team_member_records FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = team_member_records.project_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project managers and admins can manage team member records"
    ON team_member_records
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = team_member_records.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Create unique constraint for project documents
ALTER TABLE project_documents
ADD CONSTRAINT project_documents_project_id_title_unique UNIQUE (project_id, title);

-- Function to create team member document
CREATE OR REPLACE FUNCTION create_team_member_document()
RETURNS TRIGGER AS $$
DECLARE
    user_info record;
    member_record record;
    doc_title TEXT;
    doc_content TEXT;
BEGIN
    -- Fetch user details
    SELECT * INTO user_info FROM users WHERE id = NEW.user_id;
    
    -- Fetch team member record including CV data
    SELECT * INTO member_record 
    FROM team_member_records 
    WHERE project_id = NEW.project_id 
    AND user_id = NEW.user_id;
    
    -- Create document title
    doc_title := 'Team Member Profile: ' || COALESCE(user_info.full_name, 'User ' || NEW.user_id::text);
    
    -- Create document content in Markdown format
    doc_content := '## ' || COALESCE(user_info.full_name, 'New Team Member') || E'\n\n' ||
                   '### Contact Information\n' ||
                   '- Email: ' || COALESCE(user_info.email, 'Not provided') || E'\n' ||
                   CASE WHEN user_info.department IS NOT NULL 
                        THEN '- Department: ' || user_info.department || E'\n'
                        ELSE '' END ||
                   CASE WHEN user_info.position IS NOT NULL 
                        THEN '- Position: ' || user_info.position || E'\n'
                        ELSE '' END || E'\n' ||
                   
                   CASE WHEN member_record.cv_data IS NOT NULL THEN
                   '### Professional Background\n' ||
                   '#### Education\n' || COALESCE(member_record.cv_data->>'education', 'No education data available') || E'\n\n' ||
                   '#### Work Experience\n' || COALESCE(member_record.cv_data->>'work_experience', 'No work experience data available') || E'\n\n' ||
                   '#### Skills\n' || COALESCE(member_record.cv_data->>'skills', 'No skills data available') || E'\n\n' ||
                   '#### Languages\n' || COALESCE(member_record.cv_data->>'languages', 'No language data available') || E'\n\n' ||
                   '#### Certifications\n' || COALESCE(member_record.cv_data->>'certifications', 'No certifications data available') || E'\n\n'
                   ELSE '' END ||
                   
                   '### Project Role\n' ||
                   '- Joined: ' || TO_CHAR(NEW.joined_at, 'YYYY-MM-DD') || E'\n' ||
                   '- Role: ' || NEW.role || E'\n\n';

    -- First, try to update existing document
    UPDATE project_documents
    SET content = doc_content,
        updated_at = NOW()
    WHERE project_id = NEW.project_id
    AND title = doc_title;
    
    -- If no document was updated (no rows affected), insert a new one
    IF NOT FOUND THEN
        INSERT INTO project_documents (
            project_id,
            title,
            content,
            category,
            created_by
        ) VALUES (
            NEW.project_id,
            doc_title,
            doc_content,
            'Team Members',
            NEW.user_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle team member removal
CREATE OR REPLACE FUNCTION handle_team_member_removal()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the left_at timestamp
    UPDATE team_member_records
    SET left_at = NOW()
    WHERE project_id = OLD.project_id
    AND user_id = OLD.user_id;

    -- Archive the member's document by adding "[ARCHIVED]" prefix
    UPDATE project_documents
    SET title = '[ARCHIVED] ' || title,
        updated_at = NOW()
    WHERE project_id = OLD.project_id
    AND title LIKE 'Team Member Profile: ' || (SELECT full_name FROM users WHERE id = OLD.user_id);

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new team member
CREATE TRIGGER on_team_member_added
    AFTER INSERT ON project_members
    FOR EACH ROW
    EXECUTE FUNCTION create_team_member_document();

-- Trigger for team member removal
CREATE TRIGGER on_team_member_removed
    AFTER DELETE ON project_members
    FOR EACH ROW
    EXECUTE FUNCTION handle_team_member_removal(); 