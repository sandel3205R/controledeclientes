-- Create table to store custom app types for each seller
CREATE TABLE public.app_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  uses_email BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seller_id, name)
);

-- Enable RLS
ALTER TABLE public.app_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Sellers can view their own app types"
ON public.app_types FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own app types"
ON public.app_types FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own app types"
ON public.app_types FOR UPDATE
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own app types"
ON public.app_types FOR DELETE
USING (auth.uid() = seller_id);

CREATE POLICY "Admins can view all app types"
ON public.app_types FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_app_types_updated_at
BEFORE UPDATE ON public.app_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();