-- Migration: Seasonal Wird Support
-- Adds show_seasonal_wird flag to kids table
-- wird_templates already has seasonal_from/seasonal_to columns

ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS show_seasonal_wird boolean DEFAULT true;

-- Add is_seasonal flag to wird_templates for clarity in admin UI
ALTER TABLE public.wird_templates
  ADD COLUMN IF NOT EXISTS is_seasonal boolean DEFAULT false;

-- Update existing wird_templates that already have seasonal dates set
UPDATE public.wird_templates
  SET is_seasonal = true
  WHERE seasonal_from IS NOT NULL OR seasonal_to IS NOT NULL;

-- Separate column for seasonal wird completions so they never collide with regular wird
ALTER TABLE public.wird_logs
  ADD COLUMN IF NOT EXISTS seasonal_completed_items jsonb DEFAULT '[]'::jsonb;

-- Card appearance customisation for seasonal wird (admin-controlled)
ALTER TABLE public.wird_templates
  ADD COLUMN IF NOT EXISTS seasonal_card_icon text DEFAULT '🌙';
ALTER TABLE public.wird_templates
  ADD COLUMN IF NOT EXISTS seasonal_card_color_from text DEFAULT '#1A0533';
ALTER TABLE public.wird_templates
  ADD COLUMN IF NOT EXISTS seasonal_card_color_to text DEFAULT '#2D0A52';
ALTER TABLE public.wird_templates
  ADD COLUMN IF NOT EXISTS seasonal_card_accent text DEFAULT '#C47CFF';
