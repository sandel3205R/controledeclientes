-- Add referral_code to clients table
ALTER TABLE public.clients 
ADD COLUMN referral_code TEXT UNIQUE,
ADD COLUMN referred_by UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create referrals tracking table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  referrer_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referred_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  discount_percentage NUMERIC NOT NULL DEFAULT 50,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referrer_client_id, referred_client_id)
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals
CREATE POLICY "Admins can view all referrals"
ON public.referrals
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view their own referrals"
ON public.referrals
FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own referrals"
ON public.referrals
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own referrals"
ON public.referrals
FOR UPDATE
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own referrals"
ON public.referrals
FOR DELETE
USING (auth.uid() = seller_id);

-- Create trigger for updated_at
CREATE TRIGGER update_referrals_updated_at
BEFORE UPDATE ON public.referrals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      -- Generate 6 character code
      new_code := upper(substring(md5(random()::text) from 1 for 6));
      -- Check if code exists
      SELECT EXISTS(SELECT 1 FROM clients WHERE referral_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    NEW.referral_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate referral code for new clients
CREATE TRIGGER generate_client_referral_code
BEFORE INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.generate_referral_code();

-- Generate referral codes for existing clients
UPDATE public.clients 
SET referral_code = upper(substring(md5(random()::text || id::text) from 1 for 6))
WHERE referral_code IS NULL;