-- Create table to track clients that have been messaged for renewal
CREATE TABLE public.client_message_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  expiration_date DATE NOT NULL,
  messaged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent duplicate entries for same client/expiration
ALTER TABLE public.client_message_tracking 
ADD CONSTRAINT unique_client_expiration UNIQUE (client_id, expiration_date);

-- Enable RLS
ALTER TABLE public.client_message_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Sellers can view their own tracking"
ON public.client_message_tracking
FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own tracking"
ON public.client_message_tracking
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own tracking"
ON public.client_message_tracking
FOR DELETE
USING (auth.uid() = seller_id);

CREATE POLICY "Admins can view all tracking"
ON public.client_message_tracking
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));