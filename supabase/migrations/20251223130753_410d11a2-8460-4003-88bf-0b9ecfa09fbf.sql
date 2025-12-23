-- Add field to track if client has annual plan with monthly renewal (already paid)
ALTER TABLE public.clients 
ADD COLUMN is_annual_paid boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.clients.is_annual_paid IS 'Indicates if the client has an annual plan already paid, with monthly renewal dates';