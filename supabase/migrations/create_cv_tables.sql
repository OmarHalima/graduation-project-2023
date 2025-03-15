BEGIN;

-- Drop all existing policies
DROP POLICY IF EXISTS "Education History Access Policy" ON public.education_history;
DROP POLICY IF EXISTS "Work Experience Access Policy" ON public.work_experience;
DROP POLICY IF EXISTS "Skills Access Policy" ON public.skills;
DROP POLICY IF EXISTS "Language Proficiency Access Policy" ON public.language_proficiency;
DROP POLICY IF EXISTS "Certifications Access Policy" ON public.certifications;
DROP POLICY IF EXISTS "Full Access Policy for Education History" ON public.education_history;
DROP POLICY IF EXISTS "Full Access Policy for Work Experience" ON public.work_experience;
DROP POLICY IF EXISTS "Full Access Policy for Skills" ON public.skills;
DROP POLICY IF EXISTS "Full Access Policy for Language Proficiency" ON public.language_proficiency;
DROP POLICY IF EXISTS "Full Access Policy for Certifications" ON public.certifications;

-- Drop existing foreign key constraints if they exist
ALTER TABLE IF EXISTS public.education_history DROP CONSTRAINT IF EXISTS education_history_user_id_fkey;
ALTER TABLE IF EXISTS public.work_experience DROP CONSTRAINT IF EXISTS work_experience_user_id_fkey;
ALTER TABLE IF EXISTS public.skills DROP CONSTRAINT IF EXISTS skills_user_id_fkey;
ALTER TABLE IF EXISTS public.language_proficiency DROP CONSTRAINT IF EXISTS language_proficiency_user_id_fkey;
ALTER TABLE IF EXISTS public.certifications DROP CONSTRAINT IF EXISTS certifications_user_id_fkey;

-- Drop and recreate tables
DROP TABLE IF EXISTS public.education_history CASCADE;
DROP TABLE IF EXISTS public.work_experience CASCADE;
DROP TABLE IF EXISTS public.skills CASCADE;
DROP TABLE IF EXISTS public.language_proficiency CASCADE;
DROP TABLE IF EXISTS public.certifications CASCADE;

-- Create education_history table
CREATE TABLE IF NOT EXISTS public.education_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    institution TEXT NOT NULL,
    degree TEXT NOT NULL,
    field TEXT NOT NULL,
    graduation_year TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create work_experience table
CREATE TABLE IF NOT EXISTS public.work_experience (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    duration TEXT NOT NULL,
    responsibilities TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create skills table
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    level TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create language_proficiency table
CREATE TABLE IF NOT EXISTS public.language_proficiency (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    language TEXT NOT NULL,
    proficiency TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create certifications table
CREATE TABLE IF NOT EXISTS public.certifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    issuer TEXT NOT NULL,
    year TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.education_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_proficiency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

-- Create policies for all operations (insert, update, delete, select)
CREATE POLICY "Full Access Policy for Education History"
ON public.education_history
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Full Access Policy for Work Experience"
ON public.work_experience
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Full Access Policy for Skills"
ON public.skills
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Full Access Policy for Language Proficiency"
ON public.language_proficiency
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Full Access Policy for Certifications"
ON public.certifications
FOR ALL
USING (true)
WITH CHECK (true);

COMMIT; 