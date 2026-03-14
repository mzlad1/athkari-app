// Athkari Mobile — Complete TypeScript types
// Aligned with BRD v1.0 + schema patch

export type ShariaStatus =
  | "draft"
  | "review"
  | "sheikh_review"
  | "approved"
  | "published";
export type AdhkarReview =
  | "pending"
  | "approved"
  | "needs_revision"
  | "rejected";
export type BillingStatus =
  | "trial"
  | "active"
  | "past_due"
  | "churned"
  | "suspended";
export type AgeGroup = "4-6" | "7-9" | "10-12";
export type ReactionType =
  | "well_done"
  | "keep_going"
  | "masha_allah"
  | "challenge_me";

export interface Plan {
  id: number;
  name_en: string;
  name_ar: string;
  max_kids: number;
  price_monthly: number;
  price_annual: number;
  trial_days: number;
  tag: string;
  display_order: number;
  features: string[];
  regional_pricing: Record<string, { m: number; y: number }>;
  is_active: boolean;
}

export interface Category {
  id: number;
  key: string;
  title_en: string;
  title_ar: string;
  icon: string;
  gradient: string;
  display_order: number;
  is_active: boolean;
  sharia_status: ShariaStatus;
}

export interface Dhikr {
  id: number;
  category_id: number;
  text_ar: string;
  meaning_ar: string;
  meaning_en: string;
  repetition_count: number;
  points: number;
  audio_url: string | null;
  sharia_status: AdhkarReview;
  default_voice_profile_id?: number | null;
}

export interface VoiceProfile {
  id: number;
  name_ar: string;
  name_en: string;
  source: "upload" | "elevenlabs";
  elevenlabs_voice_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface VoiceFile {
  id: number;
  profile_id: number;
  adhkar_id: number;
  storage_path: string;
  public_url: string;
  audio_url: string | null;
  duration_seconds: number | null;
  generated_at: string;
  created_at: string;
}

export interface WirdTemplate {
  id: number;
  name_en: string;
  name_ar: string;
  age_group: string;
  adhkar_ids: number[];
  reward_stars: number;
  is_default: boolean;
  is_seasonal?: boolean;
  seasonal_card_icon?: string;
  seasonal_card_color_from?: string;
  seasonal_card_color_to?: string;
  seasonal_card_accent?: string;
  celebration_type?: string;
  custom_items?: {
    id: string;
    text_ar: string;
    text_en: string;
    repeat: number;
  }[];
}

export interface Kid {
  id: string;
  family_id: string;
  name: string;
  display_name?: string;
  avatar: string;
  avatar_url?: string | null;
  avatar_emoji?: string;
  age_group: AgeGroup;
  stars: number;
  streak: number;
  wird_template_id: number | null;
  engagement_score: number;
  friend_code: string;
  total_adhkar: number;
  daily_goal: number;
  last_active: string | null;
  pin_hash: string | null;
  show_seasonal_wird: boolean;
  seasonal_custom_items?: {
    id: string;
    text_ar: string;
    text_en: string;
    repeat: number;
  }[];
  preferred_voice_profile_id?: number | null;
  sounds_enabled?: boolean;
}

export interface Badge {
  id: number;
  name_en: string;
  name_ar: string;
  icon: string;
  criteria_type: string;
  threshold: number;
}

export interface Challenge {
  id: number;
  name_en: string;
  name_ar: string;
  type: "community" | "1v1";
  goal: number;
  progress: number;
  duration_days: number;
  reward_stars: number;
  participant_count: number;
  status: string;
  start_date: string;
  end_date: string;
}

export interface Family {
  id: string;
  parent_name: string;
  parent_email: string;
  plan_id: number;
  max_kids: number;
  billing_status: BillingStatus;
  billing_cycle: string;
  country: string;
  referral_code: string;
  trial_start: string;
  trial_end: string;
  auth_user_id: string;
  parent_pin_hash?: string | null;
  stripe_customer_id?: string | null;
  rc_subscriber_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
}

export interface FriendRequest {
  id: string;
  from_kid_id: string;
  to_kid_id: string;
  status: "pending" | "approved" | "rejected";
  approved_by_parent: boolean;
  created_at: string;
}

export interface Friendship {
  id: string;
  kid_id: string;
  friend_id: string;
  created_at: string;
}

export interface DailyGoal {
  id: string;
  kid_id: string;
  goal_date: string;
  target_count: number;
  completed_count: number;
  is_complete: boolean;
}
