-- Create enum for discount type
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

-- Create coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER NOT NULL DEFAULT 0,
  min_plan_value NUMERIC DEFAULT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seller_id, code)
);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coupons
CREATE POLICY "Admins can view all coupons"
ON public.coupons
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert coupons"
ON public.coupons
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update coupons"
ON public.coupons
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete coupons"
ON public.coupons
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view their own coupons"
ON public.coupons
FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own coupons"
ON public.coupons
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own coupons"
ON public.coupons
FOR UPDATE
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own coupons"
ON public.coupons
FOR DELETE
USING (auth.uid() = seller_id);

-- Create trigger for updated_at
CREATE TRIGGER update_coupons_updated_at
BEFORE UPDATE ON public.coupons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create coupon usage history table
CREATE TABLE public.coupon_usages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  original_price NUMERIC NOT NULL,
  discount_applied NUMERIC NOT NULL,
  final_price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for coupon_usages
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coupon_usages
CREATE POLICY "Admins can view all coupon usages"
ON public.coupon_usages
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view their own coupon usages"
ON public.coupon_usages
FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own coupon usages"
ON public.coupon_usages
FOR INSERT
WITH CHECK (auth.uid() = seller_id);