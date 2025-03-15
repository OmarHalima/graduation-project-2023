-- Drop existing policies
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "projects_select_policy" ON projects;
DROP POLICY IF EXISTS "project_members_select_policy" ON project_members;

-- Drop existing debug function
DROP FUNCTION IF EXISTS debug_auth();
DROP FUNCTION IF EXISTS debug_request();

-- Enable RLS but with more permissive policies for testing
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON users TO authenticated;
GRANT ALL ON projects TO authenticated;
GRANT ALL ON project_members TO authenticated;
GRANT SELECT ON users TO anon;
GRANT SELECT ON projects TO anon;
GRANT SELECT ON project_members TO anon;

-- Create more permissive policies for testing
CREATE POLICY "users_select_policy"
ON users FOR SELECT
USING (true);

CREATE POLICY "projects_select_policy"
ON projects FOR SELECT
USING (true);

CREATE POLICY "project_members_select_policy"
ON project_members FOR SELECT
USING (true);

-- Enhanced debug function for auth
CREATE OR REPLACE FUNCTION debug_auth()
RETURNS TABLE (
  role text,
  uid uuid,
  email text,
  raw_claims jsonb,
  is_authenticated boolean,
  db_user text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT 
    COALESCE(auth.role()::text, 'no_role'),
    auth.uid(),
    COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'email')::text, 'no_email'),
    COALESCE(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb),
    COALESCE((auth.role() = 'authenticated'), false),
    COALESCE(current_user::text, 'no_user');
END;
$$;

-- Additional debug function for request headers
CREATE OR REPLACE FUNCTION debug_request()
RETURNS TABLE (
  key text,
  value text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY VALUES 
    ('request.headers', current_setting('request.headers', true)),
    ('request.method', current_setting('request.method', true)),
    ('request.path', current_setting('request.path', true)),
    ('role', current_setting('role', true));
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY VALUES 
    ('error', SQLERRM);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION debug_auth TO authenticated;
GRANT EXECUTE ON FUNCTION debug_auth TO anon;
GRANT EXECUTE ON FUNCTION debug_request TO authenticated;
GRANT EXECUTE ON FUNCTION debug_request TO anon; 