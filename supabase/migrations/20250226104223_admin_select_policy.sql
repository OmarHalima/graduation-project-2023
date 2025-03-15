-- Migration: Allow admin users to select all users from public.users

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
USING (
  current_setting('jwt.claims.role', true) = 'admin'
); 