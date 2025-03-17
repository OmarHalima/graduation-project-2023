-- Create auth_audit_log table to track security events
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_security_settings table
CREATE TABLE IF NOT EXISTS public.user_security_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{
        "notifyOnNewLogin": true,
        "notifyOnPasswordChange": true,
        "notifyOnMFAChange": true,
        "requireMFAForSensitiveActions": false
    }',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create backup_codes table for MFA
CREATE TABLE IF NOT EXISTS public.backup_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    used_at TIMESTAMPTZ,
    UNIQUE (user_id, code)
);

-- Enable RLS
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Auth Audit Log policies
CREATE POLICY "Users can view their own audit logs"
ON public.auth_audit_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs"
ON public.auth_audit_log
FOR INSERT
WITH CHECK (true);

-- User Security Settings policies
CREATE POLICY "Users can view their own security settings"
ON public.user_security_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own security settings"
ON public.user_security_settings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own security settings"
ON public.user_security_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Backup Codes policies
CREATE POLICY "Users can view their own backup codes"
ON public.backup_codes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert backup codes"
ON public.backup_codes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update backup codes"
ON public.backup_codes
FOR UPDATE
USING (true);

-- Create function to generate backup codes
CREATE OR REPLACE FUNCTION generate_backup_codes(p_user_id UUID, p_count INTEGER DEFAULT 10)
RETURNS SETOF backup_codes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code TEXT;
BEGIN
    -- Delete existing unused backup codes
    DELETE FROM public.backup_codes
    WHERE user_id = p_user_id AND used = false;
    
    -- Generate new backup codes
    FOR i IN 1..p_count LOOP
        -- Generate a random 8-character code
        v_code := upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 8));
        
        -- Insert the code
        RETURN QUERY
        INSERT INTO public.backup_codes (user_id, code)
        VALUES (p_user_id, v_code)
        RETURNING *;
    END LOOP;
END;
$$;

-- Create function to validate and use a backup code
CREATE OR REPLACE FUNCTION use_backup_code(p_user_id UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_exists BOOLEAN;
BEGIN
    UPDATE public.backup_codes
    SET used = true,
        used_at = now()
    WHERE user_id = p_user_id
        AND code = upper(p_code)
        AND used = false
    RETURNING true INTO v_code_exists;
    
    RETURN COALESCE(v_code_exists, false);
END;
$$;

-- Create function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id UUID,
    p_action TEXT,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS auth_audit_log
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log auth_audit_log;
BEGIN
    INSERT INTO public.auth_audit_log (
        user_id,
        action,
        ip_address,
        user_agent,
        metadata
    )
    VALUES (
        p_user_id,
        p_action,
        p_ip_address,
        p_user_agent,
        p_metadata
    )
    RETURNING * INTO v_log;
    
    RETURN v_log;
END;
$$;

-- Create indexes for better performance
CREATE INDEX idx_auth_audit_log_user_id ON public.auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_created_at ON public.auth_audit_log(created_at);
CREATE INDEX idx_backup_codes_user_id ON public.backup_codes(user_id);
CREATE INDEX idx_backup_codes_user_id_used ON public.backup_codes(user_id, used);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.auth_audit_log TO authenticated;
GRANT ALL ON public.user_security_settings TO authenticated;
GRANT ALL ON public.backup_codes TO authenticated;
GRANT EXECUTE ON FUNCTION generate_backup_codes TO authenticated;
GRANT EXECUTE ON FUNCTION use_backup_code TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated; 