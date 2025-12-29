-- Adicionar campo de Telegram na tabela de clientes
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS telegram text;