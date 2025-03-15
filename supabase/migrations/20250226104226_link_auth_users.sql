-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraint to link with auth.users
ALTER TABLE public.users
ADD CONSTRAINT users_auth_id_fkey
FOREIGN KEY (auth_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- Create a trigger to automatically create a user profile when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, status, auth_id, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee'::user_role),
    'pending'::user_status,
    NEW.id,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to sync user profile updates
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Update auth.users metadata when public.users is updated
  IF TG_OP = 'UPDATE' THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
      'full_name', NEW.full_name,
      'role', NEW.role,
      'status', NEW.status
    )
    WHERE id = NEW.auth_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the sync trigger
DROP TRIGGER IF EXISTS on_user_profile_updated ON public.users;
CREATE TRIGGER on_user_profile_updated
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION public.sync_user_profile();

-- Update existing users to link with auth.users if not already linked
DO $$
BEGIN
  -- Try to match existing users with auth users by email
  UPDATE public.users u
  SET auth_id = a.id
  FROM auth.users a
  WHERE u.email = a.email
  AND u.auth_id IS NULL;
  
  -- Log users that couldn't be matched (you may want to handle these manually)
  CREATE TEMP TABLE IF NOT EXISTS unmatched_users AS
  SELECT id, email
  FROM public.users
  WHERE auth_id IS NULL;
END $$; 