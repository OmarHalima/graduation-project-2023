-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.user_analysis CASCADE;
DROP TABLE IF EXISTS public.user_cvs CASCADE;
DROP TABLE IF EXISTS public.user_interviews CASCADE;
DROP TABLE IF EXISTS public.user_notes CASCADE;
DROP TABLE IF EXISTS public.education_history CASCADE;
DROP TABLE IF EXISTS public.work_experience CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;
DROP TABLE IF EXISTS public.language_proficiency CASCADE;
DROP TABLE IF EXISTS public.certifications CASCADE;

-- Create user_cvs table
CREATE TABLE public.user_cvs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    UNIQUE(user_id)
);

-- Create user_interviews table
CREATE TABLE public.user_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    interview_date TIMESTAMPTZ NOT NULL,
    interviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    position TEXT,
    notes TEXT,
    result TEXT CHECK (result IN ('passed', 'failed', 'pending')),
    score INTEGER CHECK (score >= 0 AND score <= 100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create user_notes table
CREATE TABLE public.user_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    category TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create education_history table
CREATE TABLE public.education_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    institution TEXT NOT NULL,
    degree TEXT NOT NULL,
    field TEXT NOT NULL,
    graduation_year TEXT NOT NULL,
    achievements TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create work_experience table
CREATE TABLE public.work_experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    responsibilities TEXT[],
    achievements TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create skills table
CREATE TABLE public.skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create language_proficiency table
CREATE TABLE public.language_proficiency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    proficiency TEXT NOT NULL,
    certifications TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create certifications table
CREATE TABLE public.certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    issuer TEXT NOT NULL,
    year TEXT NOT NULL,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_analysis table
CREATE TABLE public.user_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    analysis_text TEXT NOT NULL,
    strengths TEXT[],
    weaknesses TEXT[],
    recommendations TEXT[],
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_cvs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_proficiency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analysis ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX idx_user_cvs_user_id ON public.user_cvs(user_id);
CREATE INDEX idx_user_interviews_user_id ON public.user_interviews(user_id);
CREATE INDEX idx_user_notes_user_id ON public.user_notes(user_id);
CREATE INDEX idx_education_history_user_id ON public.education_history(user_id);
CREATE INDEX idx_work_experience_user_id ON public.work_experience(user_id);
CREATE INDEX idx_skills_user_id ON public.skills(user_id);
CREATE INDEX idx_language_proficiency_user_id ON public.language_proficiency(user_id);
CREATE INDEX idx_certifications_user_id ON public.certifications(user_id);
CREATE INDEX idx_user_analysis_user_id ON public.user_analysis(user_id);

-- Create RLS policies for user_cvs
CREATE POLICY "Users can view their own CV"
ON public.user_cvs FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND (role = 'admin' OR role = 'project_manager')
    )
);

CREATE POLICY "Users can manage their own CV"
ON public.user_cvs
FOR ALL
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND (role = 'admin' OR role = 'project_manager')
    )
);

-- Create RLS policies for user_interviews
CREATE POLICY "Users can view their own interviews"
ON public.user_interviews FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
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
        WHERE users.id = auth.uid()
        AND (role = 'admin' OR role = 'project_manager')
    )
);

-- Create RLS policies for user_notes
CREATE POLICY "Users can view their own notes"
ON public.user_notes FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
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
        WHERE users.id = auth.uid()
        AND (role = 'admin' OR role = 'project_manager')
    )
);

-- Create RLS policies for education_history
CREATE POLICY "Users can view their own education history"
ON public.education_history FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND (role = 'admin' OR role = 'project_manager')
    )
);

CREATE POLICY "Users can manage their own education history"
ON public.education_history
FOR ALL
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND (role = 'admin' OR role = 'project_manager')
    )
);

-- Create similar RLS policies for other tables
CREATE POLICY "Users can view their own work experience"
ON public.work_experience FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND (role = 'admin' OR role = 'project_manager')
    )
);

CREATE POLICY "Users can manage their own work experience"
ON public.work_experience
FOR ALL
TO authenticated
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
        AND (role = 'admin' OR role = 'project_manager')
    )
);

-- Grant permissions
GRANT ALL ON public.user_cvs TO authenticated;
GRANT ALL ON public.user_interviews TO authenticated;
GRANT ALL ON public.user_notes TO authenticated;
GRANT ALL ON public.education_history TO authenticated;
GRANT ALL ON public.work_experience TO authenticated;
GRANT ALL ON public.skills TO authenticated;
GRANT ALL ON public.language_proficiency TO authenticated;
GRANT ALL ON public.certifications TO authenticated;
GRANT ALL ON public.user_analysis TO authenticated; 