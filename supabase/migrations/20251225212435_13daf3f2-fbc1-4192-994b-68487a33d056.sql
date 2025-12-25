-- Add screens column to clients table
ALTER TABLE public.clients ADD COLUMN screens integer DEFAULT 1;