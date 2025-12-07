-- Create servers table
CREATE TABLE public.servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  monthly_cost NUMERIC DEFAULT 0,
  credit_cost NUMERIC DEFAULT 0,
  total_credits INTEGER DEFAULT 0,
  used_credits INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- RLS policies for servers
CREATE POLICY "Admins can view all servers"
ON public.servers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert servers"
ON public.servers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update servers"
ON public.servers FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete servers"
ON public.servers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sellers can view their own servers"
ON public.servers FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own servers"
ON public.servers FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own servers"
ON public.servers FOR UPDATE
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own servers"
ON public.servers FOR DELETE
USING (auth.uid() = seller_id);

-- Add server_id to clients table
ALTER TABLE public.clients ADD COLUMN server_id UUID REFERENCES public.servers(id);

-- Trigger for updated_at
CREATE TRIGGER update_servers_updated_at
BEFORE UPDATE ON public.servers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();