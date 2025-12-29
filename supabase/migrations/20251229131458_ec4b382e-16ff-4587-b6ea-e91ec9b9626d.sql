-- Add PIX key column to bills_to_pay table
ALTER TABLE public.bills_to_pay 
ADD COLUMN recipient_pix text;