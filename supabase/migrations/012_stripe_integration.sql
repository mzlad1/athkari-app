-- ═══════════════════════════════════════════════════════════════════════
-- Migration 012: Stripe Integration — subscription tracking fields
-- ═══════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   • Add stripe_subscription_id + current_period_end to families
--   • These track the active Stripe subscription for plan changes & cancellations
--   • stripe_customer_id already exists from initial schema
--
-- Run this in your Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Add Stripe subscription tracking columns
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text DEFAULT NULL;

ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz DEFAULT NULL;

-- 2. Ensure stripe_customer_id exists (idempotent)
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS stripe_customer_id text DEFAULT NULL;

-- 3. Ensure rc_subscriber_id exists (idempotent)
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS rc_subscriber_id text DEFAULT NULL;

-- 4. Index for fast lookup by stripe_customer_id (used by webhooks)
CREATE INDEX IF NOT EXISTS idx_families_stripe_customer
  ON public.families (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 5. Index for fast lookup by stripe_subscription_id
CREATE INDEX IF NOT EXISTS idx_families_stripe_subscription
  ON public.families (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMIT;
