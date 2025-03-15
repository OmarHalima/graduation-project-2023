-- Create a function to handle user profile creation
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT,
  p_role TEXT,
  p_status TEXT,
  p_department TEXT,
  p_position TEXT,
  p_auth_id UUID
)
RETURNS users
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user users;
BEGIN
  -- Check if auth_id exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_auth_id) THEN
    RAISE EXCEPTION 'Auth user not found with ID: %', p_auth_id;
  END IF;

  -- Check if auth_id is already linked to another user
  IF EXISTS (SELECT 1 FROM public.users WHERE auth_id = p_auth_id) THEN
    RAISE EXCEPTION 'Auth ID is already linked to another user';
  END IF;

  -- Insert the user profile
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role,
    status,
    department,
    position,
    auth_id,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_email,
    p_full_name,
    p_role::user_role,
    p_status::user_status,
    p_department,
    p_position,
    p_auth_id,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_user;

  -- Update auth.users metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'full_name', p_full_name,
    'role', p_role,
    'status', p_status
  )
  WHERE id = p_auth_id;

  RETURN v_user;
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$;

-- Create a function to handle user profile updates
CREATE OR REPLACE FUNCTION update_user_profile(
  p_user_id UUID,
  p_full_name TEXT,
  p_role TEXT,
  p_status TEXT,
  p_department TEXT,
  p_position TEXT,
  p_current_user_id UUID
)
RETURNS users
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user users;
  v_current_user_role user_role;
  v_auth_id UUID;
BEGIN
  -- Get the current user's role
  SELECT role INTO v_current_user_role
  FROM users
  WHERE id = p_current_user_id;

  -- Check if user has permission to update
  IF v_current_user_role != 'admin' AND p_current_user_id != p_user_id THEN
    RAISE EXCEPTION 'Permission denied: Only admins can update other users profiles';
  END IF;

  -- Get the auth_id for the user being updated
  SELECT auth_id INTO v_auth_id
  FROM users
  WHERE id = p_user_id;

  -- Update the user profile
  UPDATE public.users
  SET
    full_name = p_full_name,
    role = CASE 
      WHEN v_current_user_role = 'admin' THEN p_role::user_role 
      ELSE role 
    END,
    status = CASE 
      WHEN v_current_user_role = 'admin' THEN p_status::user_status 
      ELSE status 
    END,
    department = p_department,
    position = p_position,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_user;

  -- Update auth.users metadata if auth_id exists
  IF v_auth_id IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object(
      'full_name', p_full_name,
      'role', CASE 
        WHEN v_current_user_role = 'admin' THEN p_role 
        ELSE (SELECT role FROM users WHERE id = p_user_id)
      END,
      'status', CASE 
        WHEN v_current_user_role = 'admin' THEN p_status 
        ELSE (SELECT status FROM users WHERE id = p_user_id)
      END
    )
    WHERE id = v_auth_id;
  END IF;

  RETURN v_user;
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Error updating user profile: %', SQLERRM;
END;
$$;

-- Create a function to handle user deletion
CREATE OR REPLACE FUNCTION delete_user_profile(
  p_user_id UUID,
  p_current_user_id UUID
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_user_role user_role;
  v_auth_id UUID;
BEGIN
  -- Get the current user's role
  SELECT role INTO v_current_user_role
  FROM users
  WHERE id = p_current_user_id;

  -- Check if user has permission to delete
  IF v_current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Permission denied: Only admins can delete users';
  END IF;

  -- Get the auth_id before deleting the user
  SELECT auth_id INTO v_auth_id
  FROM users
  WHERE id = p_user_id;

  -- Delete the user profile
  DELETE FROM public.users
  WHERE id = p_user_id;

  -- Delete from auth.users if auth_id exists
  IF v_auth_id IS NOT NULL THEN
    DELETE FROM auth.users
    WHERE id = v_auth_id;
  END IF;

  RETURN true;
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Error deleting user profile: %', SQLERRM;
END;
$$;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION create_user_profile TO service_role;
GRANT EXECUTE ON FUNCTION update_user_profile TO service_role;
GRANT EXECUTE ON FUNCTION delete_user_profile TO service_role;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION create_user_profile FROM public;
REVOKE EXECUTE ON FUNCTION update_user_profile FROM public;
REVOKE EXECUTE ON FUNCTION delete_user_profile FROM public; 