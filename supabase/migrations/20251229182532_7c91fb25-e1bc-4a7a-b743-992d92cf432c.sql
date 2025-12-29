-- Create table for tracking login attempts
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_successful BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts(attempted_at);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Admins can view all attempts
CREATE POLICY "Admins can view all login attempts"
ON public.login_attempts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete attempts (to unban users)
CREATE POLICY "Admins can delete login attempts"
ON public.login_attempts
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));