-- ═══════════════════════════════════════════════════════════════════════
-- Migration 009: Voice / Audio Feature
-- ═══════════════════════════════════════════════════════════════════════
--
-- Changes:
--   • voice_profiles  — drop legacy columns, add source/elevenlabs_voice_id/
--                       is_active/display_order
--   • voice_files     — add storage_path, public_url, created_at
--   • adhkar          — add default_voice_profile_id FK
--   • kids            — add preferred_voice_profile_id FK
--   • RLS policies    — public SELECT on voice_profiles (active) and voice_files
--
-- Storage bucket "voice-files":
--   Create manually in Supabase Dashboard → Storage → New Bucket
--   Name: voice-files  |  Public: ON
--   (Bucket creation is not available via SQL migrations)
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. voice_profiles — reshape schema
-- ─────────────────────────────────────────────────────────────────────

-- Drop the voice_status enum usage before dropping status column
-- (ALTER TABLE can't drop an enum column without casting first)
ALTER TABLE public.voice_profiles
  DROP COLUMN IF EXISTS style,
  DROP COLUMN IF EXISTS speed,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS sample_url,
  DROP COLUMN IF EXISTS category_assignments,
  DROP COLUMN IF EXISTS total_files,
  DROP COLUMN IF EXISTS cost_estimate;

ALTER TABLE public.voice_profiles
  ADD COLUMN IF NOT EXISTS source        text    NOT NULL DEFAULT 'upload'
    CONSTRAINT voice_profiles_source_check CHECK (source IN ('upload', 'elevenlabs')),
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text,
  ADD COLUMN IF NOT EXISTS is_active     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────
-- 2. voice_files — add missing columns
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.voice_files
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS public_url   text,
  ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now();

-- Back-fill from existing audio_url if present
UPDATE public.voice_files
SET
  public_url   = audio_url,
  storage_path = audio_url
WHERE public_url IS NULL AND audio_url IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 3. adhkar — default voice profile FK
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.adhkar
  ADD COLUMN IF NOT EXISTS default_voice_profile_id bigint
    REFERENCES public.voice_profiles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 4. kids — preferred voice profile FK
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS preferred_voice_profile_id bigint
    REFERENCES public.voice_profiles(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 5. RLS Policies
-- ─────────────────────────────────────────────────────────────────────

-- voice_profiles: anon + authenticated can read active profiles
DROP POLICY IF EXISTS "public_read_active_voice_profiles" ON public.voice_profiles;
CREATE POLICY "public_read_active_voice_profiles"
  ON public.voice_profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- voice_files: anon + authenticated can read all files
-- (files are served via public Storage URLs anyway)
DROP POLICY IF EXISTS "public_read_voice_files" ON public.voice_files;
CREATE POLICY "public_read_voice_files"
  ON public.voice_files
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────
-- 6. Indexes for common queries
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_voice_files_adhkar_id
  ON public.voice_files(adhkar_id);

CREATE INDEX IF NOT EXISTS idx_voice_files_profile_id
  ON public.voice_files(profile_id);

CREATE INDEX IF NOT EXISTS idx_voice_profiles_is_active
  ON public.voice_profiles(is_active);

CREATE INDEX IF NOT EXISTS idx_adhkar_default_voice_profile
  ON public.adhkar(default_voice_profile_id)
  WHERE default_voice_profile_id IS NOT NULL;

COMMIT;



ALTER TABLE public.voice_files ADD CONSTRAINT voice_files_profile_adhkar_unique UNIQUE (profile_id, adhkar_id);
