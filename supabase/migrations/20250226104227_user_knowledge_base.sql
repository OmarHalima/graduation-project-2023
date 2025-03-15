-- Create table for user CVs
CREATE TABLE IF NOT EXISTS public.user_cvs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_url TEXT,
    file_name TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES public.users(id),
    UNIQUE(user_id)
);

-- Create table for interview notes
CREATE TABLE IF NOT EXISTS public.user_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    interview_date TIMESTAMP WITH TIME ZONE NOT NULL,
    interviewer_id UUID REFERENCES public.users(id),
    notes TEXT,
    result TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for user notes
CREATE TABLE IF NOT EXISTS public.user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for user project history
CREATE TABLE IF NOT EXISTS public.user_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    responsibilities TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_user_cvs_user_id ON public.user_cvs(user_id);
CREATE INDEX idx_user_interviews_user_id ON public.user_interviews(user_id);
CREATE INDEX idx_user_notes_user_id ON public.user_notes(user_id);
CREATE INDEX idx_user_projects_user_id ON public.user_projects(user_id);
CREATE INDEX idx_user_projects_project_id ON public.user_projects(project_id);

-- Create RLS policies
ALTER TABLE public.user_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

-- CV policies
CREATE POLICY "Users can view their own CV"
    ON public.user_cvs
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

CREATE POLICY "Admins and PMs can manage CVs"
    ON public.user_cvs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'admin' OR role = 'project_manager')
        )
    );

-- Interview notes policies
CREATE POLICY "Users can view their own interviews"
    ON public.user_interviews
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

CREATE POLICY "Admins and PMs can manage interviews"
    ON public.user_interviews
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'admin' OR role = 'project_manager')
        )
    );

-- User notes policies
CREATE POLICY "Users can view their own notes"
    ON public.user_notes
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

CREATE POLICY "Admins and PMs can manage notes"
    ON public.user_notes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (role = 'admin' OR role = 'project_manager')
        )
    );

-- User projects policies
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
GRANT ALL ON public.user_cvs TO authenticated;
GRANT ALL ON public.user_interviews TO authenticated;
GRANT ALL ON public.user_notes TO authenticated;
GRANT ALL ON public.user_projects TO authenticated; 