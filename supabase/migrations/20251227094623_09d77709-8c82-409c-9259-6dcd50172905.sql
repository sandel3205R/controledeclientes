-- First, delete duplicate records keeping only the most recent one for each user
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.user_id = b.user_id 
  AND a.created_at < b.created_at;

-- Now add unique constraint on user_id for push_subscriptions
ALTER TABLE public.push_subscriptions 
ADD CONSTRAINT push_subscriptions_user_id_unique UNIQUE (user_id);

-- Add unique constraint on user_id for notification_preferences  
ALTER TABLE public.notification_preferences 
ADD CONSTRAINT notification_preferences_user_id_unique UNIQUE (user_id);