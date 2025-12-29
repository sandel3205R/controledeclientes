-- Add account_type column to clients table
ALTER TABLE public.clients 
ADD COLUMN account_type text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.clients.account_type IS 'Type of account: premium, ssh, iptv, p2p';