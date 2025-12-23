-- Add slot type columns to shared_panels
ALTER TABLE public.shared_panels 
ADD COLUMN p2p_slots integer NOT NULL DEFAULT 0,
ADD COLUMN iptv_slots integer NOT NULL DEFAULT 0;

-- Add client type to track if client is P2P or IPTV
ALTER TABLE public.clients 
ADD COLUMN shared_slot_type text CHECK (shared_slot_type IN ('p2p', 'iptv'));

-- Update existing panels: convert total_slots to iptv_slots as default
UPDATE public.shared_panels SET iptv_slots = total_slots WHERE total_slots > 0;