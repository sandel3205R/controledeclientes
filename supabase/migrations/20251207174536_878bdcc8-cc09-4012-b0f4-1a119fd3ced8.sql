-- Add server_ids array field to store multiple server references
ALTER TABLE public.clients 
ADD COLUMN server_ids uuid[] DEFAULT '{}'::uuid[];