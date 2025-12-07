-- Create table for WhatsApp message templates
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('billing', 'welcome', 'renewal', 'reminder', 'custom')),
  message TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Sellers can view their own templates"
ON public.whatsapp_templates
FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own templates"
ON public.whatsapp_templates
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own templates"
ON public.whatsapp_templates
FOR UPDATE
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own templates"
ON public.whatsapp_templates
FOR DELETE
USING (auth.uid() = seller_id);

-- Admins policies
CREATE POLICY "Admins can view all templates"
ON public.whatsapp_templates
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();