-- Add payment status column to clients table
ALTER TABLE public.clients ADD COLUMN is_paid boolean DEFAULT true;

-- Add payment notes column for optional comments
ALTER TABLE public.clients ADD COLUMN payment_notes text;