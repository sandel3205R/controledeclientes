-- Create seller_plans table for subscription tiers
CREATE TABLE public.seller_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  max_clients integer, -- NULL means unlimited
  price_monthly numeric NOT NULL DEFAULT 0,
  is_best_value boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seller_plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read plans
CREATE POLICY "Anyone can view active plans"
ON public.seller_plans
FOR SELECT
USING (is_active = true);

-- Only admins can manage plans
CREATE POLICY "Admins can manage plans"
ON public.seller_plans
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default plans
INSERT INTO public.seller_plans (name, slug, max_clients, price_monthly, is_best_value) VALUES
  ('Teste', 'trial', NULL, 0, false),
  ('Bronze', 'bronze', 100, 10.90, false),
  ('Silver', 'silver', 300, 30.90, true),
  ('Gold', 'gold', 1000, 59.90, false),
  ('Black', 'black', NULL, 97.00, false);

-- Add seller_plan_id and has_unlimited_clients to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS seller_plan_id uuid REFERENCES public.seller_plans(id),
ADD COLUMN IF NOT EXISTS has_unlimited_clients boolean DEFAULT false;

-- Set default plan (Trial) for existing users without a plan
UPDATE public.profiles 
SET seller_plan_id = (SELECT id FROM public.seller_plans WHERE slug = 'trial')
WHERE seller_plan_id IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_seller_plans_updated_at
BEFORE UPDATE ON public.seller_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();