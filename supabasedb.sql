-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.adhkar (
  id bigint NOT NULL DEFAULT nextval('adhkar_id_seq'::regclass),
  category_id bigint NOT NULL,
  text_ar text NOT NULL,
  meaning_ar text,
  meaning_en text,
  repetition_count integer NOT NULL DEFAULT 1,
  points integer NOT NULL DEFAULT 5,
  audio_url text,
  version integer NOT NULL DEFAULT 1,
  sharia_status USER-DEFINED DEFAULT 'pending'::adhkar_review,
  reviewer_id text,
  review_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT adhkar_pkey PRIMARY KEY (id),
  CONSTRAINT adhkar_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.admin_users (
  id bigint NOT NULL DEFAULT nextval('admin_users_id_seq'::regclass),
  auth_user_id uuid,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'viewer'::admin_role,
  totp_secret text,
  last_login timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT admin_users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.app_config (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_by bigint,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_config_pkey PRIMARY KEY (key),
  CONSTRAINT app_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id)
);
CREATE TABLE public.audit_log (
  id bigint NOT NULL DEFAULT nextval('audit_log_id_seq'::regclass),
  admin_id bigint,
  admin_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.badges (
  id bigint NOT NULL DEFAULT nextval('badges_id_seq'::regclass),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  icon text NOT NULL DEFAULT '🏅'::text,
  criteria_type text NOT NULL,
  threshold integer NOT NULL,
  criteria_desc text,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT badges_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categories (
  id bigint NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  key text UNIQUE,
  title_en text NOT NULL,
  title_ar text NOT NULL,
  icon text NOT NULL DEFAULT '📿'::text,
  gradient text DEFAULT '#7C3AED,#A78BFA'::text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sharia_status USER-DEFINED NOT NULL DEFAULT 'draft'::sharia_status,
  reviewer_id text,
  reviewed_at timestamp with time zone,
  status_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  celebration_type text DEFAULT 'confetti'::text,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.challenge_participants (
  challenge_id bigint NOT NULL,
  kid_id uuid NOT NULL,
  contribution integer DEFAULT 0,
  rank integer,
  rewarded_at timestamp with time zone,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT challenge_participants_pkey PRIMARY KEY (challenge_id, kid_id),
  CONSTRAINT challenge_participants_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id),
  CONSTRAINT challenge_participants_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES public.kids(id)
);
CREATE TABLE public.challenge_templates (
  id bigint NOT NULL DEFAULT nextval('challenge_templates_id_seq'::regclass),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  type text NOT NULL DEFAULT '1v1'::text,
  dhikr_text_ar text NOT NULL,
  dhikr_text_en text DEFAULT ''::text,
  goal integer NOT NULL DEFAULT 100,
  duration_days integer DEFAULT 3,
  reward_stars integer DEFAULT 50,
  celebration_type text DEFAULT 'confetti'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  description_en text DEFAULT ''::text,
  description_ar text DEFAULT ''::text,
  CONSTRAINT challenge_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.challenges (
  id bigint NOT NULL DEFAULT nextval('challenges_id_seq'::regclass),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  type USER-DEFINED NOT NULL DEFAULT 'community'::challenge_type,
  goal integer NOT NULL,
  duration_days integer NOT NULL DEFAULT 7,
  reward_stars integer NOT NULL DEFAULT 100,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status USER-DEFINED DEFAULT 'scheduled'::challenge_status,
  participant_count integer DEFAULT 0,
  progress integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  template_id bigint,
  dhikr_text_ar text DEFAULT ''::text,
  dhikr_text_en text DEFAULT ''::text,
  celebration_type text DEFAULT 'confetti'::text,
  reward_stars_2nd integer DEFAULT 0,
  reward_stars_3rd integer DEFAULT 0,
  description_en text DEFAULT ''::text,
  description_ar text DEFAULT ''::text,
  CONSTRAINT challenges_pkey PRIMARY KEY (id),
  CONSTRAINT challenges_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.challenge_templates(id)
);
CREATE TABLE public.daily_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL,
  goal_date date NOT NULL DEFAULT CURRENT_DATE,
  target_count integer NOT NULL DEFAULT 15,
  completed_count integer DEFAULT 0,
  is_complete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_goals_pkey PRIMARY KEY (id),
  CONSTRAINT daily_goals_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES public.kids(id)
);
CREATE TABLE public.device_tokens (
  id bigint NOT NULL DEFAULT nextval('device_tokens_id_seq'::regclass),
  family_id uuid NOT NULL,
  kid_id uuid,
  token text NOT NULL,
  platform text DEFAULT 'ios'::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  ip_address text,
  country text,
  city text,
  region text,
  timezone text,
  isp text,
  CONSTRAINT device_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT device_tokens_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id),
  CONSTRAINT device_tokens_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES public.kids(id)
);
CREATE TABLE public.families (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  parent_name text NOT NULL,
  parent_email text NOT NULL UNIQUE,
  plan_id bigint,
  billing_status USER-DEFINED DEFAULT 'trial'::billing_status,
  billing_cycle text DEFAULT 'monthly'::text,
  trial_start date DEFAULT CURRENT_DATE,
  trial_end date,
  stripe_customer_id text,
  rc_subscriber_id text,
  country text DEFAULT 'SA'::text,
  device_type text DEFAULT 'ios'::text,
  referred_by uuid,
  referral_code text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  parent_pin_hash text,
  ip_address text,
  city text,
  region text,
  timezone text,
  isp text,
  CONSTRAINT families_pkey PRIMARY KEY (id),
  CONSTRAINT families_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT families_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id),
  CONSTRAINT families_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.families(id)
);
CREATE TABLE public.friend_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_kid_id uuid NOT NULL,
  to_kid_id uuid NOT NULL,
  status USER-DEFINED DEFAULT 'pending'::friendship_status,
  approved_by_parent boolean DEFAULT false,
  parent_approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friend_requests_pkey PRIMARY KEY (id),
  CONSTRAINT friend_requests_from_kid_id_fkey FOREIGN KEY (from_kid_id) REFERENCES public.kids(id),
  CONSTRAINT friend_requests_to_kid_id_fkey FOREIGN KEY (to_kid_id) REFERENCES public.kids(id)
);
CREATE TABLE public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friendships_pkey PRIMARY KEY (id),
  CONSTRAINT friendships_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES public.kids(id),
  CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.kids(id)
);
CREATE TABLE public.kid_badges (
  kid_id uuid NOT NULL,
  badge_id bigint NOT NULL,
  unlocked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kid_badges_pkey PRIMARY KEY (kid_id, badge_id),
  CONSTRAINT kid_badges_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES public.kids(id),
  CONSTRAINT kid_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id)
);
CREATE TABLE public.kid_login_otps (
  id bigint NOT NULL DEFAULT nextval('kid_login_otps_id_seq'::regclass),
  family_id uuid NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kid_login_otps_pkey PRIMARY KEY (id),
  CONSTRAINT kid_login_otps_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id)
);
CREATE TABLE public.kid_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kid_id uuid NOT NULL,
  type text NOT NULL,
  title_ar text DEFAULT ''::text,
  title_en text DEFAULT ''::text,
  body_ar text DEFAULT ''::text,
  body_en text DEFAULT ''::text,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT kid_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT kid_notifications_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES public.kids(id)
);
CREATE TABLE public.kids (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  name text NOT NULL,
  avatar text DEFAULT '🧒'::text,
  age_group text NOT NULL DEFAULT '7-9'::text,
  pin_hash text,
  stars integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  streak_updated_at date DEFAULT CURRENT_DATE,
  wird_template_id bigint,
  engagement_score integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  friend_code text UNIQUE,
  total_adhkar integer DEFAULT 0,
  last_active timestamp with time zone,
  daily_goal integer DEFAULT 15,
  referred_by uuid,
  custom_adhkar_ids jsonb DEFAULT '[]'::jsonb,
  level integer NOT NULL DEFAULT 1,
  level_celebrated integer NOT NULL DEFAULT 1,
  show_seasonal_wird boolean DEFAULT true,
  seasonal_custom_items jsonb DEFAULT '[]'::jsonb,
  qr_token text UNIQUE,
  qr_expires_at timestamp with time zone,
  CONSTRAINT kids_pkey PRIMARY KEY (id),
  CONSTRAINT kids_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id),
  CONSTRAINT fk_kids_wird_template FOREIGN KEY (wird_template_id) REFERENCES public.wird_templates(id),
  CONSTRAINT kids_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.kids(id)
);
CREATE TABLE public.leaderboard_snapshots (
  id integer NOT NULL DEFAULT nextval('leaderboard_snapshots_id_seq'::regclass),
  kid_id uuid NOT NULL,
  period text NOT NULL,
  stars_earned integer DEFAULT 0,
  rank integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leaderboard_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT leaderboard_snapshots_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES public.kids(id)
);
CREATE TABLE public.levels (
  level integer NOT NULL,
  stars_required integer NOT NULL DEFAULT 0,
  emoji text NOT NULL DEFAULT '🌱'::text,
  title_en text NOT NULL,
  title_ar text NOT NULL,
  gradient_start text NOT NULL DEFAULT '#6EE7B7'::text,
  gradient_end text NOT NULL DEFAULT '#34D399'::text,
  CONSTRAINT levels_pkey PRIMARY KEY (level)
);
CREATE TABLE public.notification_template_tz_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  template_id bigint NOT NULL,
  timezone text NOT NULL,
  sent_date date NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_template_tz_log_pkey PRIMARY KEY (id),
  CONSTRAINT notification_template_tz_log_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id)
);
CREATE TABLE public.notification_templates (
  id bigint NOT NULL DEFAULT nextval('notification_templates_id_seq'::regclass),
  name text NOT NULL,
  icon text DEFAULT '🔔'::text,
  title_en text NOT NULL,
  title_ar text NOT NULL,
  body_en text NOT NULL,
  body_ar text NOT NULL,
  target_segment text DEFAULT 'everyone'::text,
  schedule text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  last_sent_at timestamp with time zone,
  CONSTRAINT notification_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id bigint NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  template_id bigint,
  title_en text,
  title_ar text,
  body_en text,
  body_ar text,
  target_segment jsonb DEFAULT '{}'::jsonb,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  stats jsonb DEFAULT '{}'::jsonb,
  created_by bigint,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id)
);
CREATE TABLE public.onboarding_screens (
  id bigint NOT NULL DEFAULT nextval('onboarding_screens_id_seq'::regclass),
  title_en text NOT NULL,
  title_ar text NOT NULL,
  desc_en text,
  desc_ar text,
  illustration text DEFAULT '🤲'::text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT onboarding_screens_pkey PRIMARY KEY (id)
);
CREATE TABLE public.plans (
  id bigint NOT NULL DEFAULT nextval('plans_id_seq'::regclass),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  max_kids integer NOT NULL DEFAULT 1,
  price_monthly numeric NOT NULL,
  price_annual numeric NOT NULL,
  trial_days integer NOT NULL DEFAULT 7,
  tag text DEFAULT ''::text,
  display_order integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  regional_pricing jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.promo_codes (
  id bigint NOT NULL DEFAULT nextval('promo_codes_id_seq'::regclass),
  code text NOT NULL UNIQUE,
  discount_type USER-DEFINED NOT NULL,
  discount_value numeric NOT NULL,
  valid_from date DEFAULT CURRENT_DATE,
  valid_to date NOT NULL,
  max_uses integer NOT NULL DEFAULT 100,
  current_uses integer NOT NULL DEFAULT 0,
  plan_filter text DEFAULT 'all'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  from_kid_id uuid NOT NULL,
  to_kid_id uuid NOT NULL,
  type text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reactions_pkey PRIMARY KEY (id),
  CONSTRAINT reactions_from_kid_id_fkey FOREIGN KEY (from_kid_id) REFERENCES public.kids(id),
  CONSTRAINT reactions_to_kid_id_fkey FOREIGN KEY (to_kid_id) REFERENCES public.kids(id)
);
CREATE TABLE public.referrals (
  id bigint NOT NULL DEFAULT nextval('referrals_id_seq'::regclass),
  referrer_id uuid NOT NULL,
  referee_id uuid,
  code text NOT NULL,
  status text DEFAULT 'pending'::text,
  reward_granted boolean DEFAULT false,
  converted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT referrals_pkey PRIMARY KEY (id),
  CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.families(id),
  CONSTRAINT referrals_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES public.families(id)
);
CREATE TABLE public.voice_files (
  id bigint NOT NULL DEFAULT nextval('voice_files_id_seq'::regclass),
  profile_id bigint NOT NULL,
  adhkar_id bigint NOT NULL,
  audio_url text NOT NULL,
  duration_seconds numeric,
  file_size_bytes integer,
  qa_status text DEFAULT 'pending'::text,
  generated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT voice_files_pkey PRIMARY KEY (id),
  CONSTRAINT voice_files_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.voice_profiles(id),
  CONSTRAINT voice_files_adhkar_id_fkey FOREIGN KEY (adhkar_id) REFERENCES public.adhkar(id)
);
CREATE TABLE public.voice_profiles (
  id bigint NOT NULL DEFAULT nextval('voice_profiles_id_seq'::regclass),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  style text DEFAULT 'Calm'::text,
  speed numeric DEFAULT 1.0,
  status USER-DEFINED DEFAULT 'processing'::voice_status,
  sample_url text,
  category_assignments jsonb DEFAULT '[]'::jsonb,
  total_files integer DEFAULT 0,
  cost_estimate numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT voice_profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.wird_logs (
  id bigint NOT NULL DEFAULT nextval('wird_logs_id_seq'::regclass),
  kid_id uuid NOT NULL,
  template_id bigint,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_items jsonb DEFAULT '[]'::jsonb,
  is_complete boolean DEFAULT false,
  bonus_awarded integer DEFAULT 0,
  completed_at timestamp with time zone,
  seasonal_completed_items jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT wird_logs_pkey PRIMARY KEY (id),
  CONSTRAINT wird_logs_kid_id_fkey FOREIGN KEY (kid_id) REFERENCES public.kids(id),
  CONSTRAINT wird_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.wird_templates(id)
);
CREATE TABLE public.wird_templates (
  id bigint NOT NULL DEFAULT nextval('wird_templates_id_seq'::regclass),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  age_group text NOT NULL DEFAULT 'All'::text,
  adhkar_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  reward_stars integer NOT NULL DEFAULT 50,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  seasonal_from date,
  seasonal_to date,
  created_at timestamp with time zone DEFAULT now(),
  celebration_type text DEFAULT 'confetti'::text,
  is_seasonal boolean DEFAULT false,
  seasonal_card_icon text DEFAULT '🌙'::text,
  seasonal_card_color_from text DEFAULT '#1A0533'::text,
  seasonal_card_color_to text DEFAULT '#2D0A52'::text,
  seasonal_card_accent text DEFAULT '#C47CFF'::text,
  custom_items jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT wird_templates_pkey PRIMARY KEY (id)
);