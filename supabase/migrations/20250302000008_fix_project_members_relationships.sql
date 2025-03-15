-- Drop existing project_members table and recreate with proper relationships
DROP TABLE IF EXISTS public.project_members CASCADE;

-- Create project_members table with explicit foreign key names
CREATE TABLE public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) 
        REFERENCES public.projects(id) ON DELETE CASCADE,
    CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT project_members_project_user_unique UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Grant permissions
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON public.project_members(user_id); 