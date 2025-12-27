-- Create message history table
CREATE TABLE public.message_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Sellers can view their own messages"
ON public.message_history
FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own messages"
ON public.message_history
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins can view all messages"
ON public.message_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for performance
CREATE INDEX idx_message_history_seller_id ON public.message_history(seller_id);
CREATE INDEX idx_message_history_sent_at ON public.message_history(sent_at DESC);