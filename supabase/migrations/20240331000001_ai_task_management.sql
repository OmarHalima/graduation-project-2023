-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create project_phases table
CREATE TABLE project_phases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sequence_order INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    created_by UUID REFERENCES auth.users(id),
    ai_metadata JSONB,
    CONSTRAINT valid_dates CHECK (start_date <= end_date)
);

-- Create phase_tasks table
CREATE TABLE phase_tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phase_id UUID REFERENCES project_phases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimated_hours FLOAT,
    assigned_to UUID REFERENCES auth.users(id),
    sequence_order INTEGER NOT NULL,
    dependencies JSONB, -- Array of task IDs this task depends on
    required_skills JSONB, -- Array of required skills
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    ai_metadata JSONB -- Store AI reasoning and context
);

-- Create ai_analysis_cache table
CREATE TABLE ai_analysis_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_project_phases_project ON project_phases(project_id);
CREATE INDEX idx_project_phases_status ON project_phases(status);
CREATE INDEX idx_phase_tasks_phase ON phase_tasks(phase_id);
CREATE INDEX idx_phase_tasks_status ON phase_tasks(status);
CREATE INDEX idx_phase_tasks_assigned ON phase_tasks(assigned_to);
CREATE INDEX idx_ai_analysis_project ON ai_analysis_cache(project_id, analysis_type);
CREATE INDEX idx_ai_analysis_validity ON ai_analysis_cache(valid_until);

-- Enable Row Level Security
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON project_phases TO authenticated;
GRANT ALL ON phase_tasks TO authenticated;
GRANT ALL ON ai_analysis_cache TO authenticated;

-- RLS Policies for project_phases
CREATE POLICY "Users can view phases of their projects"
    ON project_phases FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_phases.project_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project managers and admins can manage phases"
    ON project_phases
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = project_phases.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- RLS Policies for phase_tasks
CREATE POLICY "Users can view tasks of their projects"
    ON phase_tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_phases
            JOIN project_members ON project_phases.project_id = project_members.project_id
            WHERE project_phases.id = phase_tasks.phase_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project managers and admins can manage tasks"
    ON phase_tasks
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM project_phases
            JOIN project_members ON project_phases.project_id = project_members.project_id
            WHERE project_phases.id = phase_tasks.phase_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- RLS Policies for ai_analysis_cache
CREATE POLICY "Users can view AI analysis of their projects"
    ON ai_analysis_cache FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = ai_analysis_cache.project_id
            AND project_members.user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Project managers and admins can manage AI analysis"
    ON ai_analysis_cache
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = ai_analysis_cache.project_id
            AND project_members.user_id = auth.uid()
            AND project_members.role = 'manager'
        ) OR EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
        )
    );

-- Functions for managing phases and tasks
CREATE OR REPLACE FUNCTION update_phase_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update phase status based on its tasks
    IF NOT EXISTS (SELECT 1 FROM phase_tasks WHERE phase_id = NEW.phase_id) THEN
        -- No tasks yet, keep as pending
        UPDATE project_phases SET status = 'pending' WHERE id = NEW.phase_id;
    ELSIF NOT EXISTS (SELECT 1 FROM phase_tasks WHERE phase_id = NEW.phase_id AND status != 'completed') THEN
        -- All tasks completed
        UPDATE project_phases SET status = 'completed' WHERE id = NEW.phase_id;
    ELSIF EXISTS (SELECT 1 FROM phase_tasks WHERE phase_id = NEW.phase_id AND status = 'in_progress') THEN
        -- Has tasks in progress
        UPDATE project_phases SET status = 'in_progress' WHERE id = NEW.phase_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update phase status when tasks change
CREATE TRIGGER update_phase_status_trigger
    AFTER INSERT OR UPDATE OF status ON phase_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_phase_status();

-- Function to reorder tasks when sequence_order changes
CREATE OR REPLACE FUNCTION handle_task_reorder()
RETURNS TRIGGER AS $$
BEGIN
    -- If sequence_order changed and new position is greater
    IF NEW.sequence_order > OLD.sequence_order THEN
        -- Shift tasks in between old and new positions down
        UPDATE phase_tasks
        SET sequence_order = sequence_order - 1
        WHERE phase_id = NEW.phase_id
        AND sequence_order <= NEW.sequence_order
        AND sequence_order > OLD.sequence_order
        AND id != NEW.id;
    -- If sequence_order changed and new position is lesser
    ELSIF NEW.sequence_order < OLD.sequence_order THEN
        -- Shift tasks in between old and new positions up
        UPDATE phase_tasks
        SET sequence_order = sequence_order + 1
        WHERE phase_id = NEW.phase_id
        AND sequence_order >= NEW.sequence_order
        AND sequence_order < OLD.sequence_order
        AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for task reordering
CREATE TRIGGER handle_task_reorder_trigger
    BEFORE UPDATE OF sequence_order ON phase_tasks
    FOR EACH ROW
    EXECUTE FUNCTION handle_task_reorder();