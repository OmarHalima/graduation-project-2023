-- Drop ALL existing policies for users table
DROP POLICY IF EXISTS "Allow users to view all users" ON users;
DROP POLICY IF EXISTS "Allow users to view own profile" ON users;
DROP POLICY IF EXISTS "Allow users to update own profile" ON users;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on role" ON users;
DROP POLICY IF EXISTS "Enable delete for admins only" ON users;
DROP POLICY IF EXISTS "Enable read for all authenticated users" ON users;
DROP POLICY IF EXISTS "Enable insert for admins" ON users;
DROP POLICY IF EXISTS "Enable update for admins and own profile" ON users;
DROP POLICY IF EXISTS "Enable delete for admins" ON users;

-- Grant necessary permissions first
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON users TO authenticated;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create separate policies for each operation
-- SELECT policy - anyone can view users
CREATE POLICY "users_select_policy"
ON users FOR SELECT
TO authenticated
USING (true);

-- UPDATE policy - users can update their own profile
CREATE POLICY "users_update_policy"
ON users FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id); 