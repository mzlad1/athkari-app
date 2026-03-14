-- ═══════════════════════════════════════════════════════════════════════
-- Migration 011: Add avatar_url to kids + create kid-avatars storage bucket
-- ═══════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   • Allow kids to upload a real photo instead of (or in addition to) an emoji
--   • Stores uploaded image URLs in kids.avatar_url
--   • Creates a public Supabase Storage bucket `kid-avatars`
--   • Adds storage RLS policies so authenticated parents can upload/manage
--
-- Run this in your Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Add avatar_url column to kids (nullable — emoji stays as fallback)
ALTER TABLE public.kids
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT NULL;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Storage bucket  (run OUTSIDE a transaction — storage API DDL)
-- ─────────────────────────────────────────────────────────────────────

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kid-avatars',
  'kid-avatars',
  true,                                          -- public read
  5242880,                                       -- 5 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Storage RLS policies
-- ─────────────────────────────────────────────────────────────────────

-- Anyone can view (bucket is public)
CREATE POLICY "Public can view kid avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'kid-avatars');

-- Upload: allow both authenticated parents AND anon kid sessions
-- (Kids log in via QR/PIN — they have no Supabase JWT, so anon role is used)
CREATE POLICY "Anyone can upload kid avatars"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'kid-avatars');

-- Overwrite (upsert)
CREATE POLICY "Anyone can update kid avatars"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'kid-avatars');

-- Delete
CREATE POLICY "Anyone can delete kid avatars"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'kid-avatars');
