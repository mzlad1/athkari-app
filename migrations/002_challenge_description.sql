-- Add description columns to challenge_templates and challenges

ALTER TABLE public.challenge_templates
  ADD COLUMN IF NOT EXISTS description_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_ar text DEFAULT '';

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS description_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_ar text DEFAULT '';
