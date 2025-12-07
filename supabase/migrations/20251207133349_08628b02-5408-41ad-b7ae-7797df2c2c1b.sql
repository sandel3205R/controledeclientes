-- Add plan_name and plan_price columns to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS plan_name text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS plan_price numeric;