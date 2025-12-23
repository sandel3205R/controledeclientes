-- Create shared panels table
CREATE TABLE public.shared_panels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL,
  name text NOT NULL,
  total_slots integer NOT NULL DEFAULT 3,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_panels ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Sellers can view their own panels" 
ON public.shared_panels 
FOR SELECT 
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own panels" 
ON public.shared_panels 
FOR INSERT 
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own panels" 
ON public.shared_panels 
FOR UPDATE 
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own panels" 
ON public.shared_panels 
FOR DELETE 
USING (auth.uid() = seller_id);

CREATE POLICY "Admins can view all panels" 
ON public.shared_panels 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add shared_panel_id to clients table
ALTER TABLE public.clients ADD COLUMN shared_panel_id uuid REFERENCES public.shared_panels(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX idx_clients_shared_panel_id ON public.clients(shared_panel_id);