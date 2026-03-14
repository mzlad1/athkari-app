-- ═══════════════════════════════════════════════════════════════════════
-- Migration 010: Fix community challenges not appearing (RLS fix)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Problem: The challenge_participants SELECT policy had TWO issues:
--
--   1) Condition 2 self-references challenge_participants from within its
--      own RLS policy. PostgreSQL applies RLS to the inner query too,
--      which triggers the same policy again → infinite recursion / error.
--      The error silently kills the entire getChallenges() query, so NO
--      challenges appear at all.
--
--   2) Condition 3 checked community challenges via a plain EXISTS on the
--      challenges table. That inner query is subject to challenges RLS,
--      which could block the lookup for certain auth states.
--
-- Fix: Replace BOTH problematic conditions with SECURITY DEFINER helper
-- functions that bypass RLS, eliminating recursion and cross-table RLS
-- interference.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- Helper 1: returns true if the given challenge_id is a community challenge
-- SECURITY DEFINER bypasses challenges RLS so the check always works.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_community_challenge(p_challenge_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenges
    WHERE id = p_challenge_id
      AND type = 'community'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Helper 2: returns true if any of the current user's kids participate
-- in the given challenge. SECURITY DEFINER bypasses challenge_participants
-- RLS so we avoid the infinite self-reference recursion.
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_my_kid_in_challenge(p_challenge_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
      AND kid_id IN (
        SELECT k.id
        FROM public.kids k
        JOIN public.families f ON f.id = k.family_id
        WHERE f.auth_user_id = auth.uid()
      )
  );
$$;

-- ─────────────────────────────────────────────────────────────────────
-- Rebuild the challenge_participants SELECT policy
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_read_challenge_participants"
  ON public.challenge_participants;

CREATE POLICY "authenticated_read_challenge_participants"
  ON public.challenge_participants FOR SELECT
  TO authenticated
  USING (
    -- 1) Own kid's participation
    kid_id IN (SELECT get_my_kid_ids())
    OR
    -- 2) Co-participants in the same challenge as own kid
    --    Uses SECURITY DEFINER function to avoid self-referencing recursion
    is_my_kid_in_challenge(challenge_participants.challenge_id)
    OR
    -- 3) Community challenge — visible to all authenticated users
    --    Uses SECURITY DEFINER function to bypass challenges RLS
    is_community_challenge(challenge_participants.challenge_id)
  );

COMMIT;
