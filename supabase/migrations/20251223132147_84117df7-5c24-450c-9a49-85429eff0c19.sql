-- Add payment due date to servers
ALTER TABLE public.servers ADD COLUMN payment_due_date date;

-- Add index for payment date queries
CREATE INDEX idx_servers_payment_due_date ON public.servers(payment_due_date);