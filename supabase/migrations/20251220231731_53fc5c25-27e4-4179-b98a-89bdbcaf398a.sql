-- Add temporary password expiration column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS temp_password_expires_at timestamp with time zone DEFAULT NULL;