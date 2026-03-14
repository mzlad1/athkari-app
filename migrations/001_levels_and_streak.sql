-- Migration: Level system + streak fix
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════
-- 1. Create levels table
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.levels (
  level integer NOT NULL,
  stars_required integer NOT NULL DEFAULT 0,
  emoji text NOT NULL DEFAULT '🌱',
  title_en text NOT NULL,
  title_ar text NOT NULL,
  gradient_start text NOT NULL DEFAULT '#6EE7B7',
  gradient_end text NOT NULL DEFAULT '#34D399',
  CONSTRAINT levels_pkey PRIMARY KEY (level)
);

INSERT INTO public.levels (level, stars_required, emoji, title_en, title_ar, gradient_start, gradient_end) VALUES
  (1,    0, '🌱', 'Seedling',  'بذرة',    '#6EE7B7', '#34D399'),
  (2,   50, '🌿', 'Sprout',    'نبتة',    '#34D399', '#10B981'),
  (3,  150, '🌸', 'Blossom',   'زهرة',    '#F9A8D4', '#EC4899'),
  (4,  300, '⭐', 'Star',      'نجمة',    '#FCD34D', '#F59E0B'),
  (5,  500, '🌟', 'Shining',   'متألق',   '#F59E0B', '#D97706'),
  (6,  750, '💎', 'Diamond',   'ماسة',    '#60A5FA', '#3B82F6'),
  (7, 1100, '🔥', 'Blazing',   'متقد',    '#FB923C', '#F97316'),
  (8, 1500, '🏆', 'Champion',  'بطل',     '#A78BFA', '#7C3AED'),
  (9, 2000, '👑', 'Royal',     'ملكي',    '#7C3AED', '#5B21B6'),
  (10,3000, '🦁', 'Legend',    'أسطورة',  '#FFD700', '#F59E0B')
ON CONFLICT (level) DO NOTHING;

-- ═══════════════════════════════════════════
-- 2. Add level columns to kids table
-- ═══════════════════════════════════════════
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1;
ALTER TABLE public.kids ADD COLUMN IF NOT EXISTS level_celebrated integer NOT NULL DEFAULT 1;

-- ═══════════════════════════════════════════
-- 3. Trigger: auto-compute level when stars change
-- ═══════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.compute_kid_level()
RETURNS trigger AS $$
DECLARE
  new_level integer;
BEGIN
  SELECT l.level INTO new_level
  FROM public.levels l
  WHERE l.stars_required <= NEW.stars
  ORDER BY l.stars_required DESC
  LIMIT 1;

  NEW.level := COALESCE(new_level, 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_kid_level ON public.kids;
CREATE TRIGGER trg_compute_kid_level
  BEFORE INSERT OR UPDATE OF stars ON public.kids
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_kid_level();

-- ═══════════════════════════════════════════
-- 4. Back-fill existing kids with correct level
-- ═══════════════════════════════════════════
UPDATE public.kids k
SET level = COALESCE(
  (SELECT l.level FROM public.levels l WHERE l.stars_required <= k.stars ORDER BY l.stars_required DESC LIMIT 1),
  1
),
level_celebrated = COALESCE(
  (SELECT l.level FROM public.levels l WHERE l.stars_required <= k.stars ORDER BY l.stars_required DESC LIMIT 1),
  1
);

-- ═══════════════════════════════════════════
-- 5. RLS: allow kids to read levels table
-- ═══════════════════════════════════════════
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read levels" ON public.levels FOR SELECT USING (true);
