-- Create table for banned/deleted emails
CREATE TABLE public.banned_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text DEFAULT 'account_self_deleted',
  banned_at timestamp with time zone NOT NULL DEFAULT now(),
  banned_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banned_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can view banned emails
CREATE POLICY "Admins can view banned emails"
ON public.banned_emails
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Only admins can manage banned emails
CREATE POLICY "Admins can manage banned emails"
ON public.banned_emails
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Allow service role to insert (for self-deletion via edge function)
CREATE POLICY "Service role can insert banned emails"
ON public.banned_emails
FOR INSERT
WITH CHECK (true);