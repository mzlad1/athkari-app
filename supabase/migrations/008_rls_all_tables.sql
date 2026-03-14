-- ═══════════════════════════════════════════════════════════════════════
-- Migration 008: Enable RLS on ALL tables + create policies + indexes
-- ═══════════════════════════════════════════════════════════════════════
--
-- Principles:
--   • RLS enabled on every table — deny by default
--   • Admin dashboard uses service_role key → bypasses RLS entirely
--   • Mobile app uses anon key with parent JWT (auth.uid() = families.auth_user_id)
--   • Kids do NOT have their own Supabase auth — kid writes go through
--     edge functions (service_role). Direct client queries are scoped
--     via the parent's JWT → family_id → kid_id chain.
--   • Edge functions use service_role → bypass RLS
--   • Helper function: get_my_family_id() resolves auth.uid() → family.id
--   • Helper function: get_my_kid_ids() resolves auth.uid() → kid IDs in family
--
-- ⚠️  Tables with unclear ownership are marked at the bottom.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 0a. DROP ALL EXISTING POLICIES on every table (clean slate)
-- ─────────────────────────────────────────────────────────────────────
-- This dynamic block queries pg_policies and drops every policy on our
-- public tables so we can recreate them from scratch without conflicts.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 0b. ENABLE RLS on ALL tables (idempotent — safe to re-run)
-- ─────────────────────────────────────────────────────────────────────
-- We enable RLS here in one block so every table is locked down BEFORE
-- any policies are created. Tables without policies = deny all (anon).

ALTER TABLE public.adhkar                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_goals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_badges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_login_otps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kid_notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kids                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_screens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_files            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wird_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wird_templates         ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 0c. HELPER FUNCTIONS (used inside policies for DRY + performance)
-- ─────────────────────────────────────────────────────────────────────

-- Returns the family.id for the logged-in parent
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.families WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Returns all kid IDs belonging to the logged-in parent's family
CREATE OR REPLACE FUNCTION public.get_my_kid_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.id
  FROM public.kids k
  JOIN public.families f ON f.id = k.family_id
  WHERE f.auth_user_id = auth.uid();
$$;

-- Returns kid IDs that share a challenge with the logged-in parent's kids
CREATE OR REPLACE FUNCTION public.get_my_challenge_kid_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT cp.kid_id
  FROM public.challenge_participants cp
  WHERE cp.challenge_id IN (
    SELECT challenge_id FROM public.challenge_participants
    WHERE kid_id IN (SELECT get_my_kid_ids())
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- 1. ADMIN-ONLY TABLES (service_role bypasses RLS — no anon policies)
-- ═══════════════════════════════════════════════════════════════════════

-- admin_users: Only accessed by admin dashboard (service_role)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- audit_log: Only written/read by admin dashboard (service_role)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- notification_templates: Created/managed by admin only
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- notifications (push send history): Admin only
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- promo_codes: Admin managed; mobile validates via edge function
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- voice_profiles: Admin managed
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

-- voice_files: Admin managed
ALTER TABLE public.voice_files ENABLE ROW LEVEL SECURITY;

-- referrals: Written by edge function (referral-apply), read by admin
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- kid_login_otps: Written/read by edge function (kid-otp) only
ALTER TABLE public.kid_login_otps ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════
-- 2. APP CONFIG — public read (anon), admin write (service_role)
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_app_config"
  ON public.app_config FOR SELECT
  TO anon, authenticated
  USING (true);


-- ═══════════════════════════════════════════════════════════════════════
-- 3. PUBLIC CONTENT — read-only for authenticated + anon users
-- ═══════════════════════════════════════════════════════════════════════

-- ── categories ──
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_published_categories"
  ON public.categories FOR SELECT
  TO anon, authenticated
  USING (sharia_status = 'published' AND is_active = true);

-- ── adhkar ──
ALTER TABLE public.adhkar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_published_adhkar"
  ON public.adhkar FOR SELECT
  TO anon, authenticated
  USING (
    sharia_status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = category_id
        AND c.sharia_status = 'published'
        AND c.is_active = true
    )
  );

-- ── badges (definitions) ──
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_active_badges"
  ON public.badges FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ── levels (already has RLS from migration 001, ensure consistent) ──
-- levels already has RLS enabled + "Anyone can read levels" policy
-- We add a safety re-enable in case it was dropped
DO $$
BEGIN
  -- Drop old policy if exists to avoid conflict
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'levels' AND policyname = 'Anyone can read levels'
  ) THEN
    DROP POLICY "Anyone can read levels" ON public.levels;
  END IF;
END $$;

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_levels"
  ON public.levels FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── challenge_templates (read-only for kids picking templates) ──
ALTER TABLE public.challenge_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_active_templates"
  ON public.challenge_templates FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ── wird_templates (read-only; assigned to kids by parent/admin) ──
ALTER TABLE public.wird_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_active_wird_templates"
  ON public.wird_templates FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ── onboarding_screens (public read) ──
ALTER TABLE public.onboarding_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_active_onboarding"
  ON public.onboarding_screens FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ── plans (public read for plan selection) ──
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_active_plans"
  ON public.plans FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- ── challenges (read active/scheduled/completed challenges) ──
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_visible_challenges"
  ON public.challenges FOR SELECT
  TO authenticated
  USING (status IN ('active', 'scheduled', 'completed'));

-- Challenge INSERT: 1v1 creation by authenticated parents on behalf of kids.
-- The kid_ids in participants are verified to belong to the family in the
-- challenge_participants policy below. Direct challenge INSERT is needed
-- for the create1v1FromTemplate flow.
CREATE POLICY "authenticated_insert_challenges"
  ON public.challenges FOR INSERT
  TO authenticated
  WITH CHECK (type = '1v1');

-- Challenge UPDATE: participants update status/progress
CREATE POLICY "authenticated_update_own_challenges"
  ON public.challenges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.challenge_participants cp
      WHERE cp.challenge_id = id
        AND cp.kid_id IN (SELECT get_my_kid_ids())
    )
  );

-- Challenge DELETE: only for 1v1 reject (kid must be participant)
CREATE POLICY "authenticated_delete_own_1v1"
  ON public.challenges FOR DELETE
  TO authenticated
  USING (
    type = '1v1'
    AND EXISTS (
      SELECT 1 FROM public.challenge_participants cp
      WHERE cp.challenge_id = id
        AND cp.kid_id IN (SELECT get_my_kid_ids())
    )
  );


-- ═══════════════════════════════════════════════════════════════════════
-- 4. FAMILY-OWNED TABLES
-- ═══════════════════════════════════════════════════════════════════════

-- ── families ──
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Parent can read own family
CREATE POLICY "parent_read_own_family"
  ON public.families FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Parent can insert own family (registration)
CREATE POLICY "parent_insert_own_family"
  ON public.families FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

-- Parent can update own family (pin, settings)
CREATE POLICY "parent_update_own_family"
  ON public.families FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════
-- 5. KID-OWNED TABLES (parent accesses via family_id chain)
-- ═══════════════════════════════════════════════════════════════════════

-- ── kids ──
ALTER TABLE public.kids ENABLE ROW LEVEL SECURITY;

-- Parent reads own kids
CREATE POLICY "parent_read_own_kids"
  ON public.kids FOR SELECT
  TO authenticated
  USING (family_id = get_my_family_id());

-- Parent inserts kids (fallback from edge function)
CREATE POLICY "parent_insert_own_kids"
  ON public.kids FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id());

-- Parent updates own kids (daily_goal, wird_template_id, seasonal toggles, etc.)
CREATE POLICY "parent_update_own_kids"
  ON public.kids FOR UPDATE
  TO authenticated
  USING (family_id = get_my_family_id())
  WITH CHECK (family_id = get_my_family_id());

-- Read other kids ONLY if they are friends or co-participants in a challenge.
-- RLS is row-level (not column-level), so the client .select() must still
-- pick only safe columns (id, name, avatar, stars, streak, level, friend_code).
CREATE POLICY "authenticated_read_kids_friends_and_challengers"
  ON public.kids FOR SELECT
  TO authenticated
  USING (
    -- 1) Own kids
    family_id = get_my_family_id()
    OR
    -- 2) Friends of own kids
    id IN (
      SELECT f.friend_id FROM public.friendships f
      WHERE f.kid_id IN (SELECT get_my_kid_ids())
    )
    OR
    -- 3) Co-participants in the same challenge as own kids
    id IN (SELECT get_my_challenge_kid_ids())
  );


-- ── daily_goals ──
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_read_own_kids_goals"
  ON public.daily_goals FOR SELECT
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));

CREATE POLICY "parent_insert_own_kids_goals"
  ON public.daily_goals FOR INSERT
  TO authenticated
  WITH CHECK (kid_id IN (SELECT get_my_kid_ids()));

CREATE POLICY "parent_update_own_kids_goals"
  ON public.daily_goals FOR UPDATE
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));

-- Friends' daily goals (for leaderboard today_count)
CREATE POLICY "read_friends_goals"
  ON public.daily_goals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.kid_id IN (SELECT get_my_kid_ids())
        AND f.friend_id = daily_goals.kid_id
    )
  );


-- ── wird_logs ──
ALTER TABLE public.wird_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_read_own_kids_wird"
  ON public.wird_logs FOR SELECT
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));

CREATE POLICY "parent_insert_own_kids_wird"
  ON public.wird_logs FOR INSERT
  TO authenticated
  WITH CHECK (kid_id IN (SELECT get_my_kid_ids()));

CREATE POLICY "parent_update_own_kids_wird"
  ON public.wird_logs FOR UPDATE
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));


-- ── kid_badges ──
ALTER TABLE public.kid_badges ENABLE ROW LEVEL SECURITY;

-- Parent reads own kids' badges
CREATE POLICY "parent_read_own_kid_badges"
  ON public.kid_badges FOR SELECT
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));

-- Badge awarding is done by edge function (badge-evaluate) with service_role
-- No INSERT policy needed for anon/authenticated.


-- ── kid_notifications ──
ALTER TABLE public.kid_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_read_own_kid_notifications"
  ON public.kid_notifications FOR SELECT
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));

CREATE POLICY "parent_insert_own_kid_notifications"
  ON public.kid_notifications FOR INSERT
  TO authenticated
  WITH CHECK (kid_id IN (SELECT get_my_kid_ids()));

-- Update: mark as read
CREATE POLICY "parent_update_own_kid_notifications"
  ON public.kid_notifications FOR UPDATE
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));


-- ── device_tokens ──
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_read_own_device_tokens"
  ON public.device_tokens FOR SELECT
  TO authenticated
  USING (family_id = get_my_family_id());

CREATE POLICY "parent_insert_own_device_tokens"
  ON public.device_tokens FOR INSERT
  TO authenticated
  WITH CHECK (family_id = get_my_family_id());

CREATE POLICY "parent_update_own_device_tokens"
  ON public.device_tokens FOR UPDATE
  TO authenticated
  USING (family_id = get_my_family_id());


-- ═══════════════════════════════════════════════════════════════════════
-- 6. SOCIAL TABLES (friend requests, friendships, reactions)
-- ═══════════════════════════════════════════════════════════════════════

-- ── friend_requests ──
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Read: requests involving own kids (sent or received)
CREATE POLICY "parent_read_own_kid_requests"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (
    from_kid_id IN (SELECT get_my_kid_ids())
    OR to_kid_id IN (SELECT get_my_kid_ids())
  );

-- Insert: own kid sends a request
CREATE POLICY "parent_insert_own_kid_requests"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (from_kid_id IN (SELECT get_my_kid_ids()));

-- Update: approve/reject requests sent TO own kids
CREATE POLICY "parent_update_own_kid_requests"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (
    from_kid_id IN (SELECT get_my_kid_ids())
    OR to_kid_id IN (SELECT get_my_kid_ids())
  );


-- ── friendships ──
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Read own kids' friendships
CREATE POLICY "parent_read_own_kid_friendships"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));

-- Insert friendship rows (bidirectional insert on accept)
CREATE POLICY "parent_insert_own_kid_friendships"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (kid_id IN (SELECT get_my_kid_ids()));

-- Delete: remove friend (either direction involves own kid)
CREATE POLICY "parent_delete_own_kid_friendships"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (
    kid_id IN (SELECT get_my_kid_ids())
    OR friend_id IN (SELECT get_my_kid_ids())
  );


-- ── reactions ──
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Read: reactions sent to own kids
CREATE POLICY "parent_read_own_kid_reactions"
  ON public.reactions FOR SELECT
  TO authenticated
  USING (
    to_kid_id IN (SELECT get_my_kid_ids())
    OR from_kid_id IN (SELECT get_my_kid_ids())
  );

-- Insert: own kid sends reaction
CREATE POLICY "parent_insert_own_kid_reactions"
  ON public.reactions FOR INSERT
  TO authenticated
  WITH CHECK (from_kid_id IN (SELECT get_my_kid_ids()));

-- Update: mark as read
CREATE POLICY "parent_update_own_kid_reactions"
  ON public.reactions FOR UPDATE
  TO authenticated
  USING (to_kid_id IN (SELECT get_my_kid_ids()));


-- ═══════════════════════════════════════════════════════════════════════
-- 7. CHALLENGE PARTICIPANTS
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- Read: participants of challenges where own kid is involved OR community challenges
CREATE POLICY "authenticated_read_challenge_participants"
  ON public.challenge_participants FOR SELECT
  TO authenticated
  USING (
    -- Own kid's participation
    kid_id IN (SELECT get_my_kid_ids())
    OR
    -- Participants in same challenge as own kid
    EXISTS (
      SELECT 1 FROM public.challenge_participants cp2
      WHERE cp2.challenge_id = challenge_participants.challenge_id
        AND cp2.kid_id IN (SELECT get_my_kid_ids())
    )
    OR
    -- Community challenge participants (anyone can see)
    EXISTS (
      SELECT 1 FROM public.challenges ch
      WHERE ch.id = challenge_participants.challenge_id
        AND ch.type = 'community'
    )
  );

-- Insert: join challenge (own kid)
CREATE POLICY "parent_insert_own_kid_participation"
  ON public.challenge_participants FOR INSERT
  TO authenticated
  WITH CHECK (kid_id IN (SELECT get_my_kid_ids()));

-- Update: own kid's contribution
CREATE POLICY "parent_update_own_kid_participation"
  ON public.challenge_participants FOR UPDATE
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));

-- Delete: reject invite (own kid)
CREATE POLICY "parent_delete_own_kid_participation"
  ON public.challenge_participants FOR DELETE
  TO authenticated
  USING (kid_id IN (SELECT get_my_kid_ids()));


-- ═══════════════════════════════════════════════════════════════════════
-- 8. LEADERBOARD SNAPSHOTS
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- ⚠️ leaderboard_snapshots: Ownership unclear. Written by a scheduled job?
-- For now: authenticated users can read snapshots for own kids + friends.
-- Writes likely happen via service_role (cron/edge function).

CREATE POLICY "authenticated_read_own_and_friends_snapshots"
  ON public.leaderboard_snapshots FOR SELECT
  TO authenticated
  USING (
    kid_id IN (SELECT get_my_kid_ids())
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.kid_id IN (SELECT get_my_kid_ids())
        AND f.friend_id = leaderboard_snapshots.kid_id
    )
  );


-- ═══════════════════════════════════════════════════════════════════════
-- 9. PROMO CODE VALIDATION (read-only for authenticated during checkout)
-- ═══════════════════════════════════════════════════════════════════════

-- promo_codes already has RLS enabled (admin-only) above.
-- Mobile app validates promo codes via direct SELECT in plans service.
CREATE POLICY "authenticated_read_active_promos"
  ON public.promo_codes FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND valid_from <= CURRENT_DATE
    AND valid_to >= CURRENT_DATE
    AND current_uses < max_uses
  );


-- ═══════════════════════════════════════════════════════════════════════
-- 10. PERFORMANCE INDEXES on foreign keys used in policies
-- ═══════════════════════════════════════════════════════════════════════

-- families: fast lookup by auth_user_id (used in get_my_family_id)
CREATE INDEX IF NOT EXISTS idx_families_auth_user_id
  ON public.families (auth_user_id);

-- kids: fast lookup by family_id (used in get_my_kid_ids)
CREATE INDEX IF NOT EXISTS idx_kids_family_id
  ON public.kids (family_id);

-- kids: friend_code lookups
CREATE INDEX IF NOT EXISTS idx_kids_friend_code
  ON public.kids (friend_code) WHERE friend_code IS NOT NULL;

-- kids: qr_token lookups (for QR login verification)
CREATE INDEX IF NOT EXISTS idx_kids_qr_token
  ON public.kids (qr_token) WHERE qr_token IS NOT NULL;

-- daily_goals: kid + date lookups
CREATE INDEX IF NOT EXISTS idx_daily_goals_kid_date
  ON public.daily_goals (kid_id, goal_date);

-- wird_logs: kid + date lookups
CREATE INDEX IF NOT EXISTS idx_wird_logs_kid_date
  ON public.wird_logs (kid_id, log_date);

-- kid_badges: kid lookups
CREATE INDEX IF NOT EXISTS idx_kid_badges_kid_id
  ON public.kid_badges (kid_id);

-- kid_notifications: kid + read status
CREATE INDEX IF NOT EXISTS idx_kid_notifications_kid_read
  ON public.kid_notifications (kid_id, read);

-- kid_notifications: kid + created_at for ordering
CREATE INDEX IF NOT EXISTS idx_kid_notifications_kid_created
  ON public.kid_notifications (kid_id, created_at DESC);

-- friend_requests: from/to kid lookups
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_kid
  ON public.friend_requests (from_kid_id, status);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_kid
  ON public.friend_requests (to_kid_id, status);

-- friendships: kid lookups (bidirectional)
CREATE INDEX IF NOT EXISTS idx_friendships_kid_id
  ON public.friendships (kid_id);

CREATE INDEX IF NOT EXISTS idx_friendships_friend_id
  ON public.friendships (friend_id);

-- reactions: to_kid + read
CREATE INDEX IF NOT EXISTS idx_reactions_to_kid_read
  ON public.reactions (to_kid_id, read);

CREATE INDEX IF NOT EXISTS idx_reactions_from_kid
  ON public.reactions (from_kid_id);

-- challenge_participants: challenge + kid
CREATE INDEX IF NOT EXISTS idx_challenge_participants_kid
  ON public.challenge_participants (kid_id);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge
  ON public.challenge_participants (challenge_id);

-- challenges: status for filtering
CREATE INDEX IF NOT EXISTS idx_challenges_status
  ON public.challenges (status);

-- device_tokens: family + kid lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_family
  ON public.device_tokens (family_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_kid
  ON public.device_tokens (kid_id) WHERE kid_id IS NOT NULL;

-- leaderboard_snapshots: kid lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_kid
  ON public.leaderboard_snapshots (kid_id);

-- adhkar: category_id for join in policy
CREATE INDEX IF NOT EXISTS idx_adhkar_category_id
  ON public.adhkar (category_id);

-- categories: sharia_status + is_active for filtered reads
CREATE INDEX IF NOT EXISTS idx_categories_published
  ON public.categories (sharia_status, is_active)
  WHERE sharia_status = 'published' AND is_active = true;

-- referrals: referrer lookup
CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON public.referrals (referrer_id);

-- kid_login_otps: family lookup
CREATE INDEX IF NOT EXISTS idx_kid_login_otps_family
  ON public.kid_login_otps (family_id);

-- audit_log: admin_id for filtering
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id
  ON public.audit_log (admin_id);

-- notifications: template_id
CREATE INDEX IF NOT EXISTS idx_notifications_template
  ON public.notifications (template_id);

-- voice_files: profile + adhkar
CREATE INDEX IF NOT EXISTS idx_voice_files_profile
  ON public.voice_files (profile_id);

CREATE INDEX IF NOT EXISTS idx_voice_files_adhkar
  ON public.voice_files (adhkar_id);

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════
-- ⚠️  TABLES WITH UNCLEAR OWNERSHIP — REVIEW BEFORE APPLYING
-- ═══════════════════════════════════════════════════════════════════════
--
-- ⚠️ leaderboard_snapshots
--    Who writes these? If it's a scheduled cron job or edge function with
--    service_role, the current policy (read-only for own kids + friends)
--    is correct. If kids write their own snapshots, we need an INSERT policy.
--
-- ⚠️ onboarding_screens
--    Currently set to public read (anon + authenticated) for active screens.
--    Writes are admin-only (service_role). Confirm this is sufficient or if
--    there's a different access pattern.
--
-- ⚠️ referrals
--    Currently admin-only (no anon/authenticated policies). The mobile app
--    reads referral stats via the referrals service, but the actual SELECT
--    only queries families.referral_code and kids.friend_code — not the
--    referrals table directly. If the parent dashboard needs direct reads,
--    add a SELECT policy scoped to referrer_id = get_my_family_id().
--
-- ⚠️ kid_login_otps
--    Currently admin-only (no anon/authenticated policies). All access goes
--    through the kid-otp edge function with service_role. Confirm no
--    direct client reads are needed.
--
-- ✅ kids table — RESOLVED
--    Tightened to: own kids + friends + co-challenge participants.
--
-- ═══════════════════════════════════════════════════════════════════════
