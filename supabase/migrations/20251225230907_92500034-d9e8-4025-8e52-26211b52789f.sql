-- Create bills_to_pay table for tracking payments
CREATE TABLE public.bills_to_pay (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  description TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_whatsapp TEXT,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  is_paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bills_to_pay ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Sellers can view their own bills"
ON public.bills_to_pay
FOR SELECT
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own bills"
ON public.bills_to_pay
FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own bills"
ON public.bills_to_pay
FOR UPDATE
USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own bills"
ON public.bills_to_pay
FOR DELETE
USING (auth.uid() = seller_id);

CREATE POLICY "Admins can view all bills"
ON public.bills_to_pay
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_bills_to_pay_updated_at
BEFORE UPDATE ON public.bills_to_pay
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();