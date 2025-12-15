-- Add columns for login/password 4 and 5
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS login4 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS password4 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS login5 text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS password5 text;