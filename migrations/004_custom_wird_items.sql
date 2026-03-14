-- Migration: Custom Text Items for Seasonal Wird
-- Allows admins to add free-text items to a wird template (not tied to adhkar table)
-- Allows parents to add kid-specific custom text items to their child's seasonal wird

ALTER TABLE public.wird_templates
  ADD COLUMN IF NOT EXISTS custom_items jsonb DEFAULT '[]'::jsonb;

ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS seasonal_custom_items jsonb DEFAULT '[]'::jsonb;
