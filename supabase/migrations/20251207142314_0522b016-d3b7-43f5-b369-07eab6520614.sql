-- Add optional fields for app, mac address and server name
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS app_name TEXT,
ADD COLUMN IF NOT EXISTS mac_address TEXT,
ADD COLUMN IF NOT EXISTS server_name TEXT;