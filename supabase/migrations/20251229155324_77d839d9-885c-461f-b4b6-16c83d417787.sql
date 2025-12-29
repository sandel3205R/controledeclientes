-- Create table for custom account categories
CREATE TABLE public.account_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'tag',
  color TEXT DEFAULT 'gray',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own categories
CREATE POLICY "Sellers can view their own categories" 
ON public.account_categories 
FOR SELECT 
USING (auth.uid() = seller_id);

-- Sellers can insert their own categories
CREATE POLICY "Sellers can insert their own categories" 
ON public.account_categories 
FOR INSERT 
WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own categories
CREATE POLICY "Sellers can update their own categories" 
ON public.account_categories 
FOR UPDATE 
USING (auth.uid() = seller_id);

-- Sellers can delete their own categories
CREATE POLICY "Sellers can delete their own categories" 
ON public.account_categories 
FOR DELETE 
USING (auth.uid() = seller_id);

-- Admins can view all categories
CREATE POLICY "Admins can view all categories" 
ON public.account_categories 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_account_categories_updated_at
BEFORE UPDATE ON public.account_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();