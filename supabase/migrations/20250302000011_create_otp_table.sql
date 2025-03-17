-- Create user_otps table for storing OTP codes
CREATE TABLE IF NOT EXISTS public.user_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, code)
);

-- Create index for faster lookups
CREATE INDEX idx_user_otps_user_id ON public.user_otps(user_id);
CREATE INDEX idx_user_otps_email ON public.user_otps(email);

-- Enable RLS
ALTER TABLE public.user_otps ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "User can manage their own OTPs"
ON public.user_otps
FOR ALL
USING (auth.uid() = user_id);

-- Allow the service role to manage all OTPs
CREATE POLICY "Service role can manage all OTPs"
ON public.user_otps
FOR ALL
USING (true)
WITH CHECK (true);

-- Create a function to clean up expired OTPs
CREATE OR REPLACE FUNCTION clean_expired_otps()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.user_otps
  WHERE expires_at < NOW() AND verified = false;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to clean expired OTPs whenever a new OTP is created
CREATE TRIGGER clean_expired_otps_trigger
AFTER INSERT ON public.user_otps
EXECUTE FUNCTION clean_expired_otps(); 