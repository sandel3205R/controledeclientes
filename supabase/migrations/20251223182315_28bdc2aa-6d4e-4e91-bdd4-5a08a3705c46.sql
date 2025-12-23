-- Add credit recharge cost tracking to servers
ALTER TABLE public.servers ADD COLUMN credit_recharge_cost numeric DEFAULT 0;