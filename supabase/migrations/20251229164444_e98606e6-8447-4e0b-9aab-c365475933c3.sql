-- Create admin messages table
CREATE TABLE public.admin_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage messages"
ON public.admin_messages
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Sellers can view active messages
CREATE POLICY "Sellers can view active messages"
ON public.admin_messages
FOR SELECT
USING (
  is_active = true 
  AND (expires_at IS NULL OR expires_at > now())
);

-- Trigger for updated_at
CREATE TRIGGER update_admin_messages_updated_at
BEFORE UPDATE ON public.admin_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();