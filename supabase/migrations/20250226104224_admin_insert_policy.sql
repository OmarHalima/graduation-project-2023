-- Migration: Allow admin users to insert new records into public.users

DROP POLICY IF EXISTS "Admins can insert users" ON public.users;

CREATE POLICY "Admins can insert users"
ON public.users
FOR INSERT
WITH CHECK (
  current_setting('jwt.claims.role', true) = 'admin'
);

GRANT INSERT ON public.users TO authenticated; 