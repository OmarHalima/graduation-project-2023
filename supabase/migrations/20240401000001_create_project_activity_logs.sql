-- Create project_activity_logs table
CREATE TABLE project_activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('task_completed', 'decision', 'note', 'phase_completed')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    related_entity_id UUID,
    related_entity_type TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create index for better performance
CREATE INDEX idx_project_activity_logs_project_id ON project_activity_logs(project_id);
CREATE INDEX idx_project_activity_logs_user_id ON project_activity_logs(user_id);
CREATE INDEX idx_project_activity_logs_activity_type ON project_activity_logs(activity_type);
CREATE INDEX idx_project_activity_logs_related_entity ON project_activity_logs(related_entity_id, related_entity_type);

-- Enable RLS
ALTER TABLE project_activity_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON project_activity_logs TO authenticated;

-- RLS Policies for project_activity_logs
CREATE POLICY "Users can view project activity logs"
    ON project_activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_activity_logs.project_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project members can insert activity logs"
    ON project_activity_logs FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_activity_logs.project_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Function to automatically create documentation from completed tasks
CREATE OR REPLACE FUNCTION log_completed_task()
RETURNS TRIGGER AS $$
DECLARE
    task_info record;
    user_info record;
    phase_info record;
    doc_title TEXT;
    doc_content TEXT;
    activity_id UUID;
BEGIN
    -- Only proceed if the task status is changing to 'completed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
        -- Get task information
        task_info := NEW;
        
        -- Get user information
        SELECT full_name INTO user_info FROM users WHERE id = NEW.assigned_to;
        
        -- Get phase information if available
        IF NEW.phase_id IS NOT NULL THEN
            SELECT name INTO phase_info FROM project_phases WHERE id = NEW.phase_id;
        END IF;
        
        -- Create activity log entry
        INSERT INTO project_activity_logs (
            project_id,
            user_id,
            activity_type,
            title,
            description,
            related_entity_id,
            related_entity_type,
            metadata
        ) VALUES (
            NEW.project_id,
            NEW.assigned_to,
            'task_completed',
            'Task Completed: ' || NEW.title,
            COALESCE(NEW.description, 'No description provided'),
            NEW.id,
            'task',
            jsonb_build_object(
                'task_id', NEW.id,
                'task_title', NEW.title,
                'completed_by', NEW.assigned_to,
                'completed_by_name', COALESCE(user_info.full_name, 'Unknown User'),
                'phase_id', NEW.phase_id,
                'phase_name', COALESCE(phase_info.name, 'No Phase'),
                'priority', NEW.priority,
                'estimated_hours', NEW.estimated_hours,
                'due_date', NEW.due_date
            )
        ) RETURNING id INTO activity_id;
        
        -- Create or update project documentation
        doc_title := 'Task Logs';
        
        -- Check if document already exists
        SELECT content INTO doc_content 
        FROM project_documents 
        WHERE project_id = NEW.project_id 
        AND (title = doc_title OR title = 'Completed Tasks Log')
        ORDER BY updated_at DESC
        LIMIT 1;
        
        IF FOUND THEN
            -- Update existing document
            doc_content := doc_content || E'\n\n' ||
                '### ' || NEW.title || ' (' || TO_CHAR(NOW(), 'YYYY-MM-DD') || ')' || E'\n' ||
                '**Completed by:** ' || COALESCE(user_info.full_name, 'Unknown User') || E'\n' ||
                '**Phase:** ' || COALESCE(phase_info.name, 'No Phase') || E'\n' ||
                '**Description:** ' || COALESCE(NEW.description, 'No description provided') || E'\n' ||
                '**Priority:** ' || NEW.priority || E'\n' ||
                CASE WHEN NEW.estimated_hours IS NOT NULL 
                    THEN '**Estimated Hours:** ' || NEW.estimated_hours || E'\n'
                    ELSE '' END ||
                CASE WHEN NEW.due_date IS NOT NULL 
                    THEN '**Due Date:** ' || TO_CHAR(NEW.due_date::date, 'YYYY-MM-DD') || E'\n'
                    ELSE '' END;
                
            -- Get the ID of the document to update
            DECLARE
                doc_id UUID;
            BEGIN
                SELECT id INTO doc_id
                FROM project_documents
                WHERE project_id = NEW.project_id
                AND (title = doc_title OR title = 'Completed Tasks Log')
                ORDER BY updated_at DESC
                LIMIT 1;
                
                UPDATE project_documents
                SET title = doc_title, -- Ensure we update to the standard title
                    content = doc_content,
                    updated_at = NOW()
                WHERE id = doc_id;
            END;
        ELSE
            -- Create new document
            doc_content := '# Task Logs' || E'\n\n' ||
                'This document automatically tracks completed tasks in the project.' || E'\n\n' ||
                '### ' || NEW.title || ' (' || TO_CHAR(NOW(), 'YYYY-MM-DD') || ')' || E'\n' ||
                '**Completed by:** ' || COALESCE(user_info.full_name, 'Unknown User') || E'\n' ||
                '**Phase:** ' || COALESCE(phase_info.name, 'No Phase') || E'\n' ||
                '**Description:** ' || COALESCE(NEW.description, 'No description provided') || E'\n' ||
                '**Priority:** ' || NEW.priority || E'\n' ||
                CASE WHEN NEW.estimated_hours IS NOT NULL 
                    THEN '**Estimated Hours:** ' || NEW.estimated_hours || E'\n'
                    ELSE '' END ||
                CASE WHEN NEW.due_date IS NOT NULL 
                    THEN '**Due Date:** ' || TO_CHAR(NEW.due_date::date, 'YYYY-MM-DD') || E'\n'
                    ELSE '' END;
                
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
                'Task Logs',
                NEW.assigned_to
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log completed phases
CREATE OR REPLACE FUNCTION log_completed_phase()
RETURNS TRIGGER AS $$
DECLARE
    phase_info record;
    user_info record;
    doc_title TEXT;
    doc_content TEXT;
    activity_id UUID;
    task_count INTEGER;
BEGIN
    -- Only proceed if the phase status is changing to 'completed'
    IF (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
        -- Get phase information
        phase_info := NEW;
        
        -- Get user information
        SELECT full_name INTO user_info FROM users WHERE id = NEW.created_by;
        
        -- Count tasks in this phase
        SELECT COUNT(*) INTO task_count 
        FROM tasks 
        WHERE phase_id = NEW.id;
        
        -- Create activity log entry
        INSERT INTO project_activity_logs (
            project_id,
            user_id,
            activity_type,
            title,
            description,
            related_entity_id,
            related_entity_type,
            metadata
        ) VALUES (
            NEW.project_id,
            NEW.created_by,
            'phase_completed',
            'Phase Completed: ' || NEW.name,
            COALESCE(NEW.description, 'No description provided'),
            NEW.id,
            'phase',
            jsonb_build_object(
                'phase_id', NEW.id,
                'phase_name', NEW.name,
                'completed_by', NEW.created_by,
                'completed_by_name', COALESCE(user_info.full_name, 'Unknown User'),
                'task_count', task_count,
                'start_date', NEW.start_date,
                'end_date', NEW.end_date,
                'sequence_order', NEW.sequence_order
            )
        ) RETURNING id INTO activity_id;
        
        -- Create or update project documentation
        doc_title := 'Phase Logs';
        
        -- Check if document already exists
        SELECT content INTO doc_content 
        FROM project_documents 
        WHERE project_id = NEW.project_id 
        AND (title = doc_title OR title = 'Project Phases Progress')
        ORDER BY updated_at DESC
        LIMIT 1;
        
        IF FOUND THEN
            -- Update existing document
            doc_content := doc_content || E'\n\n' ||
                '### ' || NEW.name || ' - Completed (' || TO_CHAR(NOW(), 'YYYY-MM-DD') || ')' || E'\n' ||
                '**Description:** ' || COALESCE(NEW.description, 'No description provided') || E'\n' ||
                '**Tasks Completed:** ' || task_count || E'\n' ||
                '**Phase Duration:** ' || 
                CASE 
                    WHEN NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL 
                    THEN TO_CHAR(NEW.start_date::date, 'YYYY-MM-DD') || ' to ' || TO_CHAR(NEW.end_date::date, 'YYYY-MM-DD')
                    ELSE 'Not specified'
                END || E'\n';
                
            -- Get the ID of the document to update
            DECLARE
                doc_id UUID;
            BEGIN
                SELECT id INTO doc_id
                FROM project_documents
                WHERE project_id = NEW.project_id
                AND (title = doc_title OR title = 'Project Phases Progress')
                ORDER BY updated_at DESC
                LIMIT 1;
                
                UPDATE project_documents
                SET title = doc_title, -- Ensure we update to the standard title
                    content = doc_content,
                    updated_at = NOW()
                WHERE id = doc_id;
            END;
        ELSE
            -- Create new document
            doc_content := '# Phase Logs' || E'\n\n' ||
                'This document automatically tracks completed phases in the project.' || E'\n\n' ||
                '### ' || NEW.name || ' - Completed (' || TO_CHAR(NOW(), 'YYYY-MM-DD') || ')' || E'\n' ||
                '**Description:** ' || COALESCE(NEW.description, 'No description provided') || E'\n' ||
                '**Tasks Completed:** ' || task_count || E'\n' ||
                '**Phase Duration:** ' || 
                CASE 
                    WHEN NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL 
                    THEN TO_CHAR(NEW.start_date::date, 'YYYY-MM-DD') || ' to ' || TO_CHAR(NEW.end_date::date, 'YYYY-MM-DD')
                    ELSE 'Not specified'
                END || E'\n';
                
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
                'Phase Logs',
                NEW.created_by
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER on_task_completed
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_completed_task();

CREATE TRIGGER on_phase_completed
    AFTER UPDATE ON project_phases
    FOR EACH ROW
    EXECUTE FUNCTION log_completed_phase(); 