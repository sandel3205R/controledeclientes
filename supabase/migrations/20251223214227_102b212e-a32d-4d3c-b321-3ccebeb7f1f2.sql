-- Create table for client apps (Clouddy, IBO PRO, IBO PLAYER)
CREATE TABLE public.client_apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  app_type TEXT NOT NULL CHECK (app_type IN ('clouddy', 'ibo_pro', 'ibo_player')),
  -- Clouddy uses email/password
  email TEXT,
  password TEXT,
  -- IBO uses MAC + ID
  mac_address TEXT,
  device_id TEXT,
  -- Common fields
  app_price NUMERIC DEFAULT 0,
  activation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- One app per client
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.client_apps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all client apps"
ON public.client_apps FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert client apps"
ON public.client_apps FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update client apps"
ON public.client_apps FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete client apps"
ON public.client_apps FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sellers can view their own client apps"
ON public.client_apps FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own client apps"
ON public.client_apps FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own client apps"
ON public.client_apps FOR UPDATE
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own client apps"
ON public.client_apps FOR DELETE
USING (auth.uid() = seller_id);

-- Trigger for updated_at
CREATE TRIGGER update_client_apps_updated_at
BEFORE UPDATE ON public.client_apps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();