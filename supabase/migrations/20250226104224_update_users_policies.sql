-- Drop existing policies
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for own profile and admins" ON public.users;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.users;

-- Create new policies for the users table
CREATE POLICY "Enable read access for all authenticated users"
ON public.users
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for service role"
ON public.users
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Enable update for own profile and admins"
ON public.users
FOR UPDATE
TO authenticated
USING (
    auth.uid() = auth_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin'
    )
)
WITH CHECK (
    auth.uid() = auth_id OR
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

CREATE POLICY "Enable delete for admins"
ON public.users
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role; 