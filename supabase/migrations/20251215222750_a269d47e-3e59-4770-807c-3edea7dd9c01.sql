-- Add columns for additional login/password combinations
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS login2 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS password2 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS login3 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS password3 text;