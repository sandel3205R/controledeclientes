-- Fix app_settings to only allow authenticated users to read
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;

CREATE POLICY "Authenticated users can read settings" 
ON public.app_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);