-- Add column to track if user needs to update password to meet new requirements
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS needs_password_update BOOLEAN DEFAULT true;

-- Set existing users to need password update (they may have weak passwords)
UPDATE public.profiles SET needs_password_update = true WHERE needs_password_update IS NULL;

-- New users created after this will also start with true, and set to false after they set a strong password