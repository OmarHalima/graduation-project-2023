-- Add project_name column to user_projects table
ALTER TABLE public.user_projects
ADD COLUMN project_name TEXT NOT NULL;

-- Create index for project_name
CREATE INDEX idx_user_projects_project_name ON public.user_projects(project_name);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view their own projects" ON public.user_projects;
DROP POLICY IF EXISTS "Admins and PMs can manage projects" ON public.user_projects;

-- Recreate policies with project_name
CREATE POLICY "Users can view their own projects"
    ON public.user_projects
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'admin' OR role = 'project_manager')
        )
    );

CREATE POLICY "Admins and PMs can manage projects"
    ON public.user_projects
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'admin' OR role = 'project_manager')
        )
    );

-- Grant permissions
GRANT ALL ON public.user_projects TO authenticated; 