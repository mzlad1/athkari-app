-- ═══════════════════════════════════════════════════════════════════════
-- Migration 013: Add max_kids column to families table
-- ═══════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   • Track each family's kid limit directly on the families table
--   • manage-subscription edge function writes this when plans change
--   • Default 1 (free-tier limit), updated when subscribing to a plan
--
-- Run this in your Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Add max_kids column with sensible default
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS max_kids integer NOT NULL DEFAULT 1;

-- 2. Back-fill from current plan assignment
UPDATE public.families f
   SET max_kids = p.max_kids
  FROM public.plans p
 WHERE f.plan_id = p.id
   AND f.max_kids = 1;

COMMIT;
