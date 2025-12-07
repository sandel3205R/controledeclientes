-- Add subscription fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN subscription_expires_at timestamp with time zone,
ADD COLUMN is_permanent boolean DEFAULT false;

-- Set all existing active users as permanent (no renewal needed)
UPDATE public.profiles 
SET is_permanent = true 
WHERE is_active = true;

-- Update handle_new_user function to set 3-day trial for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, subscription_expires_at, is_permanent)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data ->> 'full_name',
    NOW() + INTERVAL '3 days',
    false
  );
  
  -- First user becomes admin (permanent), others are sellers with trial
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    -- Admin is always permanent
    UPDATE public.profiles SET is_permanent = true WHERE id = NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'seller');
  END IF;
  
  RETURN NEW;
END;
$function$;