-- Add pro feature fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_pro_export boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pro_export_expires_at timestamp with time zone DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.has_pro_export IS 'Whether seller has Pro export feature enabled';
COMMENT ON COLUMN public.profiles.pro_export_expires_at IS 'When the Pro export feature expires';