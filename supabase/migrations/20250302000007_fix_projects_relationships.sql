-- Drop existing table and its dependencies
DROP TABLE IF EXISTS projects CASCADE;

-- Create projects table with proper relationships
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'planning',
    budget DECIMAL,
    progress INTEGER DEFAULT 0,
    owner_id UUID NOT NULL REFERENCES public.users(id),
    manager_id UUID REFERENCES public.users(id),
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT progress_range CHECK (progress >= 0 AND progress <= 100)
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

-- Create policy to view all projects
DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
CREATE POLICY "projects_select_policy"
ON public.projects FOR SELECT
TO authenticated
USING (true);

-- Create policy to insert projects
DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
CREATE POLICY "projects_insert_policy"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'project_manager')
    )
);

-- Create policy to update projects
DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
CREATE POLICY "projects_update_policy"
ON public.projects FOR UPDATE
TO authenticated
USING (
    auth.uid() = owner_id OR
    auth.uid() = manager_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'project_manager')
    )
);

-- Create policy to delete projects
DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;
CREATE POLICY "projects_delete_policy"
ON public.projects FOR DELETE
TO authenticated
USING (
    auth.uid() = owner_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS projects_manager_id_idx ON public.projects(manager_id);
CREATE INDEX IF NOT EXISTS projects_created_by_idx ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects(status);

-- Create project_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- Enable RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Grant permissions on project_members
GRANT ALL ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

-- Create policy to view project members
DROP POLICY IF EXISTS "project_members_select_policy" ON public.project_members;
CREATE POLICY "project_members_select_policy"
ON public.project_members FOR SELECT
TO authenticated
USING (true);

-- Create policy to manage project members
DROP POLICY IF EXISTS "project_members_manage_policy" ON public.project_members;
CREATE POLICY "project_members_manage_policy"
ON public.project_members
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id
        AND (
            p.owner_id = auth.uid() OR
            p.manager_id = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.users
                WHERE users.id = auth.uid()
                AND users.role = 'admin'
            )
        )
    )
); 