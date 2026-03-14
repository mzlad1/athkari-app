# Athkari — Technical Briefing Document

**Prepared for:** Stakeholder Meeting  
**Date:** March 14, 2026  
**Version:** 1.0  
**Codebase Scanned:** Full project — 28 screens, 27 components, 19 hooks, 17 services, 22 edge functions, 31 database tables, 13 migrations

---

## 1. 📱 PROJECT OVERVIEW

### What Is Athkari?

Athkari is a **children's Islamic daily remembrance (Azkar) mobile application** with a full parental subscription and monitoring system. It transforms the traditional practice of daily Azkar — short prayers and phrases recited by Muslims throughout the day — into an engaging, gamified experience designed for children aged 4–12.

### Who Are the Users?

The app serves a **dual-user model**:

- **Children (primary consumers):** Navigate a colorful, animated, dark-themed "night-sky" world where they tap through Azkar, earn stars, unlock badges, compete in challenges, maintain daily streaks, and interact with friends through pre-set safe reactions.
- **Parents (decision-makers and payers):** Operate in a separate warm-toned "dawn" interface where they register, subscribe, add and manage children, assign daily Wird (prayer programs), monitor activity analytics, approve friend requests, and control social features per child.

### What Pain Point Does It Solve?

Muslim families want their children to build a habit of daily Azkar, but:

- Traditional methods (books, paper lists) don't engage children digitally.
- Existing Azkar apps are designed for adults — plain text, no gamification, no child safety.
- Parents need visibility into whether their children are actually practicing.
- There is no safe social layer for children to encourage each other in worship.

Athkari addresses all of these with a purpose-built, child-safe, parent-controlled, bilingual (Arabic/English) application.

### What Makes It Different From a Basic Azkar App?

| Feature              | Basic Azkar App | Athkari                                                                         |
| -------------------- | --------------- | ------------------------------------------------------------------------------- |
| Audience             | Adults          | Children (4-12) with parental control                                           |
| Gamification         | None            | Stars, levels (10 tiers), badges, streaks, challenges                           |
| Social               | None            | Safe friend system with parental approval, pre-set reactions (no freeform chat) |
| Content Control      | Static          | 5-stage Sharia review pipeline (draft → sheikh_review → published)              |
| Wird (Daily Program) | None            | Customizable daily programs per child, seasonal content                         |
| Monetization         | Free/ads        | Ad-free subscription with family plans (1/3/5 kids)                             |
| Voice                | None            | AI voice recitation (ElevenLabs TTS)                                            |
| Analytics            | None            | Full parental dashboard with weekly charts, category breakdown                  |
| RTL/Bilingual        | Arabic only     | Full Arabic + English with runtime RTL/LTR switching                            |

---

## 2. 🛠️ TECHNOLOGY STACK — WITH JUSTIFICATION

### Core Framework

| Technology       | Version | What It Is                         | Why It's Right for Athkari                                                                                                                                                                                                                                                                                 |
| ---------------- | ------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React Native** | 0.76.9  | Cross-platform mobile framework    | Single codebase for iOS and Android, critical for a niche market where maintaining two native codebases is not economically viable. Children's apps must be on both platforms — parents choose the device.                                                                                                 |
| **Expo**         | ~52.0.0 | React Native toolchain and runtime | Managed workflow drastically reduces build complexity. Expo's OTA updates allow pushing content and bug fixes without app store review — important for an Azkar app that may need rapid corrections to religious content. Provides camera, notifications, haptics, audio, and image picker out of the box. |
| **TypeScript**   | ~5.3.0  | Typed JavaScript                   | Type safety across 80+ files prevents runtime crashes in a children's app where reliability is paramount. Types like `BillingStatus`, `AgeGroup`, `ShariaStatus` enforce domain correctness at compile time.                                                                                               |

### Backend & Database

| Technology                                   | What It Is                                                                                 | Why It's Right                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase** (`@supabase/supabase-js` v2.45) | Open-source Firebase alternative (PostgreSQL + Auth + Edge Functions + Storage + Realtime) | PostgreSQL's relational model is ideal for the complex relationships (families → kids → friends → challenges → badges). Row Level Security (RLS) enforces data isolation at the database level — a parent can never see another family's children. Real-time subscriptions power live challenge updates. Edge Functions (Deno) handle Stripe, push notifications, and TTS without a custom server. Cost-effective compared to Firebase for read-heavy workloads (children repeatedly fetching Azkar content). |
| **Supabase Auth**                            | JWT-based authentication                                                                   | Parents authenticate with email/password. Kids use PIN-based or QR-code login (no email required for children — a deliberate child-safety decision).                                                                                                                                                                                                                                                                                                                                                          |
| **Supabase Storage**                         | Object storage (S3-compatible)                                                             | Stores kid avatar photos (`kid-avatars` bucket, 5MB limit, public) and AI-generated voice files (`voice-files` bucket).                                                                                                                                                                                                                                                                                                                                                                                       |
| **Supabase Edge Functions** (22 functions)   | Serverless Deno functions                                                                  | Handle all external API integrations (Stripe, ElevenLabs, Expo Push) and atomic business logic (streak calculation, badge evaluation, referral rewards) without exposing API keys to the client.                                                                                                                                                                                                                                                                                                              |
| **Supabase Realtime**                        | WebSocket-based live data                                                                  | Powers live challenge participation counters, admin config updates, and content changes — children see real-time progress in community challenges.                                                                                                                                                                                                                                                                                                                                                            |

### Navigation

| Technology               | What It Is                | Why It's Right                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Expo Router** (~4.0.0) | File-system based routing | The app has three distinct navigation zones: `(auth)/` for onboarding, `(tabs)/` for children, and `(parent-dashboard)/` for parents. File-based routing maps these cleanly to directories. Deep linking support enables push notification tap-through to specific screens. |

### State Management & Data Fetching

| Technology                                                             | What It Is                           | Why It's Right                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React Context** (`AuthContext`, `LangContext`)                       | Built-in React state management      | Lightweight and sufficient for the two global concerns: authentication state and language/RTL direction. No Redux overhead needed.                                                                                                                                                                                |
| **SWR** (v2.4.1)                                                       | Stale-while-revalidate data fetching | Automatic background revalidation keeps data fresh without manual refresh logic. Used in hooks like `useBadges`, `useChallenges`, `useFriends`, `useKidStats` with configurable revalidation intervals (5s–60s). Perfect for a children's app where data should feel instant even with intermittent connectivity. |
| **AsyncStorage** (`@react-native-async-storage/async-storage` v1.23.1) | Persistent local key-value store     | Stores user preferences (sounds, haptics, notifications), completed categories per day, active kid selection, onboarding state, and per-kid parental controls. Enables offline-first experience for settings.                                                                                                     |

### Payments & Subscriptions

| Technology                                         | What It Is                            | Why It's Right                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stripe** (`@stripe/stripe-react-native` v0.38.6) | Payment processing with Payment Sheet | Handles subscription creation, trial periods, plan changes, cancellations, invoices, and payment methods. Server-side setup via `create-payment-intent` edge function keeps Stripe keys off the client. Webhook (`stripe-webhook`) keeps billing status in sync.  |
| **RevenueCat** (`react-native-purchases` v8.12.0)  | Native IAP abstraction layer          | Provides iOS App Store and Google Play in-app purchase support as an alternative to Stripe. The dual-provider architecture (`services/subscriptions.ts`) allows the app to use native IAP where required by platform policy and Stripe for web/alternative flows. |

### UI, Animation & Child Experience

| Technology                            | What It Is                         | Why It's Right                                                                                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **React Native Reanimated** (~3.16.0) | High-performance animation library | Powers the extensive animation system: spinning avatar rings, bouncing stars, pulsing streaks, confetti particles, spring-based tap feedback. Children's apps live or die by animation quality — Reanimated runs animations on the UI thread for 60fps smoothness. |
| **Expo Linear Gradient** (~14.0.2)    | Gradient backgrounds               | Used in 20+ components. Every screen, card, button, and progress bar uses gradients. The warm-to-cool palette system (amber for parents, purple/navy for kids) is built entirely on gradients.                                                                     |
| **Expo Haptics** (~14.0.1)            | Tactile feedback                   | Light impact on every dhikr tap, success notification on completions, warning feedback on errors. Haptic feedback is critical for a tap-to-count interface — children feel each count.                                                                             |
| **Expo AV** (~15.0.2)                 | Audio playback                     | Plays AI-generated voice recitations of Azkar and sound effects (10 events: tap, dhikr_complete, level_up, badge_unlock, etc.). Volume levels vary per event (0.3–1.0). Respects user's sounds_enabled preference.                                                 |
| **Lottie React Native** (7.1.0)       | After Effects animation player     | Available for complex vector animations (splash, celebrations).                                                                                                                                                                                                    |
| **React Native QRCode SVG** (v6.3.21) | QR code generation                 | Parents can show a QR code for kids to scan for passwordless login — a smart UX choice for young children who can't type passwords.                                                                                                                                |

### Other Notable Packages

| Package                           | Purpose                                     |
| --------------------------------- | ------------------------------------------- |
| **expo-camera** (~16.0.18)        | QR code scanning for kid login              |
| **expo-image-picker** (~16.0.6)   | Avatar photo upload (camera + gallery)      |
| **expo-notifications** (~0.29.14) | Push notification registration and handling |
| **expo-clipboard** (~7.0.1)       | Copy friend codes to clipboard              |
| **expo-sharing** (~13.0.1)        | Share friend codes via OS share sheet       |
| **expo-localization** (~16.0.1)   | Detect device locale for default language   |
| **react-native-svg** (15.8.0)     | SVG rendering for ring progress indicators  |

---

## 3. 🏗️ APPLICATION ARCHITECTURE

### Folder Structure

```
athkari-mobile/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx               # Root navigator, auth guard, providers
│   ├── index.tsx                 # Onboarding carousel
│   ├── (auth)/                   # Auth flow group
│   │   ├── role-select.tsx       # Parent vs. Kid fork
│   │   ├── parent-register.tsx   # Parent sign-up/login
│   │   ├── kid-login.tsx         # Kid QR/PIN login
│   │   ├── kid-setup.tsx         # New kid profile setup
│   │   ├── add-kid.tsx           # Add additional child
│   │   ├── plans.tsx             # Subscription selection
│   │   └── referral.tsx          # Referral code entry
│   ├── (tabs)/                   # Kid-facing tab navigator
│   │   ├── home.tsx              # Daily hub — wird, goals, categories
│   │   ├── challenges.tsx        # Challenges, leaderboard, friends
│   │   ├── badges.tsx            # Achievement display
│   │   └── [categoryId].tsx      # Category redirect
│   ├── (parent-dashboard)/       # Parent-facing tab navigator
│   │   ├── kids.tsx              # Kids management + wird assignment
│   │   ├── monitor.tsx           # Activity analytics + charts
│   │   ├── friends.tsx           # Friend management + chat
│   │   ├── plans.tsx             # Subscription management
│   │   └── settings.tsx          # Account + per-kid controls
│   ├── dhikr/[categoryId].tsx    # Core Azkar reading experience (modal)
│   ├── challenge/[challengeId].tsx # Challenge participation (modal)
│   ├── bedtime.tsx               # Sleep Azkar mode
│   ├── notifications.tsx         # Notification inbox
│   ├── edit-profile.tsx          # Avatar & name editor
│   ├── add-friend.tsx            # Add friend by code
│   └── settings.tsx              # Kid settings modal
├── components/                   # Reusable UI components
│   ├── auth/                     # AuthHeader, PinInput
│   ├── dhikr/                    # DhikrCard, CompletionCelebration, DhikrProgress
│   ├── gamification/             # BadgeCard, CelebrationOverlay, ChallengeCard,
│   │                             # LevelRoad, LevelUpCelebration, StarCounter,
│   │                             # LeaderboardRow, StreakDisplay
│   ├── ui/                       # Avatar, Button, Card, ConfirmModal, Loading,
│   │                             # ProgressBar, RingProgress, Skeleton, SubTabBar, Toast
│   ├── AppGate.tsx               # Maintenance mode / force-update overlay
│   └── SplashScreen.tsx          # Animated splash
├── hooks/                        # 19 custom hooks (data fetching + business logic)
├── services/                     # 17 service modules (Supabase + external APIs)
├── contexts/                     # AuthContext, LangContext
├── constants/                    # levels.ts, theme.ts, translations.ts (~400 keys)
├── types/                        # database.ts (TypeScript interfaces + enums)
├── functions/                    # 22 Supabase Edge Functions (Deno)
├── migrations/                   # 6 incremental SQL migrations
├── supabase/migrations/          # 7 additional migrations (RLS, voice, QR, Stripe)
├── assets/                       # fonts/, sounds/
└── athkari-admin/                # Separate admin dashboard (Vite + React)
```

### Organization Pattern

The project uses a **role-segmented, screen-based architecture**:

1. **Screens** are organized by user role in Expo Router groups: `(auth)/`, `(tabs)/` (kid), `(parent-dashboard)/` (parent)
2. **Components** are organized by domain: `auth/`, `dhikr/`, `gamification/`, `ui/`
3. **Hooks** serve as the data access layer — each hook wraps Supabase queries with SWR caching and real-time subscriptions
4. **Services** contain pure business logic functions called by hooks and screens
5. **Edge Functions** handle server-side operations that need API keys or atomic transactions

### Data Flow: Frontend → Supabase

```
Screen → Hook (SWR + Realtime) → Service (Supabase client) → Supabase DB
                                    ↓
                              Edge Function → External API (Stripe, ElevenLabs, Expo Push)
```

- **Direct client queries:** Hooks like `useAdhkar`, `useCategories`, `useBadges` query Supabase tables directly via the JS client with RLS enforcement.
- **Service layer:** Complex operations (multi-table updates, business logic validation) go through `services/*.ts` which compose Supabase queries.
- **Edge Functions:** External integrations and atomic server-side operations that cannot run on the client (Stripe checkout, push notifications, voice generation).

### Authentication Flow

**Parents:**

1. Register with email + password → Supabase Auth creates user → `auth-register` edge function creates `families` row + generates referral code
2. Login with email + password → Supabase Auth session → `AuthContext` loads family data + kids

**Children (no email required — deliberate child-safety design):**

1. **PIN Login:** Parent sets a 4-digit PIN per kid → Kid selects profile → Enters PIN → `verify-parent-pin` edge function validates hash → `AuthContext` stores kid in AsyncStorage (no Supabase JWT for kids)
2. **QR Login:** Parent shows QR code (from `kids.qr_token`) → Kid scans with expo-camera → Direct auth via token → Same AsyncStorage persistence
3. **OTP Login:** Kid requests OTP → `kid-otp` edge function generates 6-digit code → Push notification sent to parent's device → Kid enters OTP → Verified against DB

**Auth Guard (in `app/_layout.tsx`):** The root layout contains a comprehensive routing guard that checks:

- Supabase session status
- Active kid selection state
- User role (parent vs kid)
- Family setup state (do kids exist?)
- Redirects unauthorized access to appropriate auth screens

### How Subscription Status Affects the App

The `families.billing_status` field (`trial` | `active` | `past_due` | `churned` | `suspended`) controls:

- **Feature gating:** `useFeatureFlags` checks subscription status to enable/disable challenges, friends, wird, voice profiles
- **Kid limits:** `families.max_kids` (default 1 for free, 3 or 5 for paid plans) enforced when adding children
- **Friend limits:** Free users limited to 1 friend; paid plans allow up to 30 (from `app_config`)
- **Voice profiles:** AI voice recitation access gated by subscription
- **Parent dashboard visibility:** Plans tab shows current subscription details, change options, invoices

---

## 4. 🗄️ SUPABASE BACKEND BREAKDOWN

### Complete Table Inventory (31 Tables)

#### Core User Tables

| Table           | Purpose                | Key Columns                                                                                                                                                                                                                                                                                                                                              | Relationships                                                      |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **families**    | Parent accounts        | `auth_user_id`, `parent_name`, `parent_email`, `plan_id`, `billing_status`, `billing_cycle`, `trial_start/end`, `stripe_customer_id`, `rc_subscriber_id`, `stripe_subscription_id`, `current_period_end`, `max_kids`, `referral_code`, `parent_pin_hash`, geo fields (`country`, `city`, `timezone`, `isp`)                                              | FK → auth.users, plans; has_many → kids, device_tokens             |
| **kids**        | Child profiles         | `family_id`, `name`, `avatar`, `avatar_url`, `age_group`, `pin_hash`, `stars`, `streak`, `streak_updated_at`, `total_adhkar`, `daily_goal`, `friend_code`, `level`, `level_celebrated`, `wird_template_id`, `show_seasonal_wird`, `seasonal_custom_items`, `custom_adhkar_ids`, `qr_token`, `qr_expires_at`, `preferred_voice_profile_id`, `referred_by` | FK → families, wird_templates, kids (self-referential referred_by) |
| **admin_users** | Admin dashboard access | `auth_user_id`, `email`, `name`, `role` (viewer/editor/admin), `totp_secret`                                                                                                                                                                                                                                                                             | FK → auth.users                                                    |

#### Content Tables

| Table                  | Purpose                                          | Key Columns                                                                                                                          | Relationships                                           |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **categories**         | Dhikr categories (Morning, Evening, Sleep, etc.) | `key`, `title_en/ar`, `icon`, `gradient`, `display_order`, `is_active`, `sharia_status`, `status_history` (JSON), `celebration_type` | has_many → adhkar                                       |
| **adhkar**             | Individual remembrance items                     | `category_id`, `text_ar`, `meaning_ar/en`, `repetition_count`, `points`, `audio_url`, `sharia_status`, `default_voice_profile_id`    | FK → categories, voice_profiles; has_many → voice_files |
| **onboarding_screens** | Onboarding carousel slides                       | `title_en/ar`, `desc_en/ar`, `illustration` (emoji), `display_order`, `is_active`                                                    | Standalone                                              |
| **app_config**         | Dynamic key-value configuration                  | `key` (PK), `value` (JSONB)                                                                                                          | Updated by admin_users                                  |

#### Gamification Tables

| Table                      | Purpose                                 | Key Columns                                                                                                                                                                           | Relationships                                               |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **levels**                 | 10-tier progression (Seedling → Legend) | `level` (PK), `stars_required`, `emoji`, `title_en/ar`, `gradient_start/end`                                                                                                          | Referenced by kids.level (auto-computed via trigger)        |
| **badges**                 | Achievement definitions                 | `name_en/ar`, `icon`, `criteria_type` (dhikr_count/streak/stars/wird_count/friend_count/category_count), `threshold`, `is_active`                                                     | has_many → kid_badges                                       |
| **kid_badges**             | Badge unlock records                    | `kid_id` (PK), `badge_id` (PK), `unlocked_at`                                                                                                                                         | FK → kids, badges                                           |
| **daily_goals**            | Daily dhikr targets                     | `kid_id`, `goal_date`, `target_count`, `completed_count`, `is_complete`                                                                                                               | FK → kids                                                   |
| **challenges**             | Community/1v1 competitions              | `name_en/ar`, `type` (community/1v1), `goal`, `duration_days`, `reward_stars`, `reward_stars_2nd/3rd`, `status` (scheduled/active/completed), `description_en/ar`, `celebration_type` | has_many → challenge_participants; FK → challenge_templates |
| **challenge_participants** | Per-kid challenge progress              | `challenge_id` (PK), `kid_id` (PK), `contribution`, `rank`, `rewarded_at`                                                                                                             | FK → challenges, kids                                       |

#### Wird (Daily Program) Tables

| Table              | Purpose                     | Key Columns                                                                                                                                                                               | Relationships                       |
| ------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **wird_templates** | Customizable daily programs | `name_en/ar`, `age_group`, `adhkar_ids` (JSONB array), `reward_stars`, `is_default`, `is_seasonal`, `seasonal_from/to`, `custom_items` (JSONB), `celebration_type`, seasonal card styling | Referenced by kids.wird_template_id |
| **wird_logs**      | Daily completion records    | `kid_id`, `template_id`, `log_date`, `completed_items` (JSONB), `is_complete`, `bonus_awarded`, `seasonal_completed_items` (JSONB)                                                        | FK → kids, wird_templates           |

#### Social Tables

| Table               | Purpose                      | Key Columns                                                                                      | Relationships            |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| **friendships**     | Bidirectional friend links   | `kid_id` (PK), `friend_id` (PK)                                                                  | FK → kids (both columns) |
| **friend_requests** | Pending requests             | `from_kid_id` (PK), `to_kid_id` (PK), `status` (pending/approved/rejected), `approved_by_parent` | FK → kids                |
| **reactions**       | Pre-set friend interactions  | `from_kid_id`, `to_kid_id`, `type` (well_done/keep_going/masha_allah/challenge_me), `read`       | FK → kids                |
| **referrals**       | Kid-to-kid referral tracking | `referrer_id`, `referee_id`, `code`, `status` (pending/completed), `reward_granted`              | FK → families            |

#### Notification Tables

| Table                            | Purpose                         | Key Columns                                                                                                             | Relationships                           |
| -------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **device_tokens**                | Push notification tokens        | `family_id`, `kid_id` (nullable), `token` (UNIQUE), `platform` (ios/android), `is_active`, geo fields                   | FK → families, kids                     |
| **kid_notifications**            | In-app notification inbox       | `kid_id`, `type`, `title_ar/en`, `body_ar/en`, `data` (JSONB), `read`                                                   | FK → kids                               |
| **notification_templates**       | Admin-managed scheduled pushes  | `name`, `title_en/ar`, `body_en/ar`, `target_segment`, `schedule` (HH:MM\|freq\|tz format), `is_active`, `last_sent_at` | has_many → notification_template_tz_log |
| **notification_template_tz_log** | Per-timezone send deduplication | `template_id`, `timezone`, `sent_date`, UNIQUE constraint                                                               | FK → notification_templates             |
| **notifications**                | Push notification send history  | `template_id`, `title_en/ar`, `body_en/ar`, `target_segment` (JSONB), `stats` (JSONB), `scheduled_at`, `sent_at`        | FK → notification_templates             |

#### Payment & Subscription Tables

| Table           | Purpose                       | Key Columns                                                                                                                        | Relationships                  |
| --------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **plans**       | Subscription plan definitions | `name_en/ar`, `max_kids`, `price_monthly/annual`, `trial_days`, `tag`, `features` (JSONB), `regional_pricing` (JSONB), `is_active` | Referenced by families.plan_id |
| **promo_codes** | Discount codes                | `code` (UNIQUE), `discount_type` (percent/fixed), `discount_value`, `valid_from/to`, `max_uses`, `current_uses`, `plan_filter`     | Standalone                     |

#### Voice & Audio Tables

| Table              | Purpose                 | Key Columns                                                                                                             | Relationships               |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **voice_profiles** | AI voice configurations | `name_en/ar`, `source` (upload/elevenlabs), `elevenlabs_voice_id`, `is_active`, `display_order`                         | has_many → voice_files      |
| **voice_files**    | Generated TTS audio     | `profile_id`, `adhkar_id`, `storage_path`, `public_url`, `duration_seconds`, `qa_status`, UNIQUE(profile_id, adhkar_id) | FK → voice_profiles, adhkar |

#### Admin & Audit Tables

| Table         | Purpose              | Key Columns                                                                                                 | Relationships    |
| ------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| **audit_log** | Admin action history | `admin_id`, `admin_name`, `action`, `entity_type`, `entity_id`, `old_value/new_value` (JSONB), `ip_address` | FK → admin_users |

### Row Level Security (RLS)

**Migration `008_rls_all_tables.sql`** enables RLS on all 31 tables with 40+ policies:

- **Helper functions** (SECURITY DEFINER):
  - `get_my_family_id()` — Returns the family_id for the authenticated user
  - `get_my_kid_ids()` — Returns array of kid IDs belonging to user's family
  - `get_my_challenge_kid_ids()` — Returns kid IDs participating in same challenges (for leaderboard visibility)

- **Policy model:**
  - Parents can only read/write their own family's data
  - Kids within a family can see each other
  - Friend data is visible only between connected kids
  - Challenge data is visible to participants
  - Categories, adhkar, badges, levels, plans are read-only for all authenticated users
  - Admin tables restricted to admin role
  - `service_role` bypasses all RLS (used by edge functions)

- **Migration `010_fix_community_challenge_rls.sql`** fixes RLS recursion issues in `challenge_participants` with additional SECURITY DEFINER helpers.

### Edge Functions (22 Total)

| Function                  | Trigger                   | Purpose                                                                                                                                             |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **activity-log**          | Client call               | Awards stars per dhikr (capped at 500/day), updates `kids.stars` and `total_adhkar`, updates `wird_logs.completed_items`, triggers `badge-evaluate` |
| **analytics-aggregate**   | Admin call                | Returns MRR, ARR, active users, trial conversion rate, churn rate, active kids today                                                                |
| **auth-login**            | Client call               | 4 modes: parent email/password, kid OTP send, kid OTP verify, kid PIN verify                                                                        |
| **auth-register**         | Client call               | Creates Supabase auth user + `families` row + referral code + audit log entry                                                                       |
| **badge-evaluate**        | Triggered by activity-log | Checks all badge criteria against kid stats, awards new badges, sends push + in-app notifications                                                   |
| **create-payment-intent** | Client call               | Creates Stripe customer/subscription with trial, resolves plan → product → price, handles promo codes, returns `client_secret` + `ephemeralKey`     |
| **daily-goal**            | Client call               | GET: today's goal progress. POST: increment `completed_count`, set `is_complete`                                                                    |
| **friend-manage**         | Client call               | send_request, approve (+25⭐), reject, remove, send_reaction (pre-set only)                                                                         |
| **kid-notify**            | Internal                  | Stores notification in `kid_notifications`, fetches device tokens, sends via Expo Push API (bilingual)                                              |
| **kid-otp**               | Client call               | Generates 6-digit OTP (5-min expiry), pushes to parent's device tokens                                                                              |
| **kid-progress**          | Client call               | Returns comprehensive kid stats + today's wird progress + badges                                                                                    |
| **manage-subscription**   | Client call               | cancel, change_plan, resume, list invoices, payment_methods, upcoming_invoice                                                                       |
| **push-scheduled**        | Cron job                  | Evaluates `notification_templates` per timezone, sends matching pushes, deduplicates via `notification_template_tz_log`                             |
| **push-send**             | Admin call                | Manual push: accepts title/body/segment/timezones, batches via Expo Push (100/batch)                                                                |
| **referral-apply**        | Client call               | Validates referrer/referee, sets `kids.referred_by`, awards +50⭐ to referrer, sends notification                                                   |
| **sharia-transition**     | Admin call                | Validates Sharia status transitions (draft → review → sheikh_review → approved → published), enforces reviewer, appends to `status_history`         |
| **streak-check**          | Client call               | Evaluates streak continuity: today's wird done → increment; gap → reset. Milestone bonuses: 7→50⭐, 30→200⭐, 100→500⭐                             |
| **stripe-webhook**        | Stripe events             | Handles `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`. Maps Stripe status → `billing_status`                  |
| **subscription-webhook**  | RevenueCat events         | Maps RC product IDs → plan IDs, updates `billing_status/plan_id/billing_cycle/max_kids`                                                             |
| **verify-parent-pin**     | Client call               | Validates parent PIN hash, returns `{valid, no_pin_set?}`                                                                                           |
| **voice-generate**        | Admin call                | Calls ElevenLabs TTS (`eleven_multilingual_v2`), uploads MP3 to `voice-files` storage bucket, upserts `voice_files` row                             |
| **wird-assign**           | Client call               | Returns today's wird: fetches template (manual or auto by age/seasonal), returns adhkar details + today's progress                                  |

### Storage Buckets

| Bucket          | Purpose                    | Max Size | Access                                                  |
| --------------- | -------------------------- | -------- | ------------------------------------------------------- |
| **kid-avatars** | Child profile photos       | 5 MB     | Public (with storage RLS policies)                      |
| **voice-files** | AI-generated TTS MP3 audio | —        | Public (served via `public_url` in `voice_files` table) |

### Real-time Subscriptions

Used in the following hooks for live updates:

- `useAdhkar` — Content changes (admin edits)
- `useAppConfig` — Dynamic configuration changes
- `useBadges` — New badge unlocks
- `useCategories` — Category additions/removals
- `useChallenges` — Challenge status changes, participant updates
- `usePlans` — Plan pricing changes
- Challenge detail screen (`challenge/[challengeId].tsx`) — Live `challenge_participants.contribution` updates

---

## 5. 📲 SCREENS & FEATURES

### Onboarding / Auth Screens

| Screen                    | Route                     | User Sees                                                                                                         | Key Technical Detail                                                                                                                              |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Onboarding Carousel**   | `/` (index)               | 3+ animated slides with floating emojis, gradient backgrounds, bilingual text                                     | Fetches slides from `onboarding_screens` table; falls back to hardcoded slides. 12 color theme rotation. Sets `@onboarding_done` in AsyncStorage. |
| **Role Select**           | `/(auth)/role-select`     | Two large cards: "I'm a Parent" (warm amber) vs. "I'm a Kid" (night sky). Floating moon + praying hands parallax. | Staggered card slide-in animations (120ms offset). Sets role in `AuthContext`.                                                                    |
| **Parent Register/Login** | `/(auth)/parent-register` | Toggle between register (name + email + password) and login (email + password)                                    | Mode switch with fade animation. Calls `authService.registerParent()` or `loginParent()`. Min 6-char password.                                    |
| **Kid Login**             | `/(auth)/kid-login`       | Two tabs: Camera (QR scan) / PIN Entry. Night-sky with twinkling stars. PIN as 4 animated dots + custom numpad.   | `expo-camera` for QR scanning. Custom PinDots component (not TextInput). Geo detection via IP API (3 fallbacks).                                  |
| **Kid Setup**             | `/(auth)/kid-setup`       | 12-emoji avatar grid, name input, 3 age group pills (4-6 / 7-9 / 10-12)                                           | Spring animation on age pill press. Updates `kids` table. Routes to referral.                                                                     |
| **Add Kid**               | `/(auth)/add-kid`         | Same as kid-setup + optional 4-digit PIN                                                                          | Called from parent dashboard for 2nd+ children. Calls `authService.addKid()`.                                                                     |
| **Plans**                 | `/(auth)/plans`           | Annual/monthly toggle, 3-4 plan cards, feature list, promo code input                                             | Promo code validation via `plansService`. Stripe payment sheet integration. Staggered feature fade-in.                                            |
| **Referral**              | `/(auth)/referral`        | Gift icon with orbiting dots, referral code input, skip option                                                    | `referralService.verifyKidCode()` + `applyKidReferral()`. Awards +50⭐ to both kids.                                                              |

### Child-Facing Screens

| Screen               | Route                              | User Sees                                                                                                                                                  | Key Technical Detail                                                                                                                                        |
| -------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home Hub**         | `/(tabs)/home`                     | Avatar with spinning ring, daily goal (circular progress), wird items with tap-to-complete, categories grid (3 columns), active challenges, streak display | 14-second rotation animation. SWR data fetching with pull-to-refresh. Celebration overlays on wird/badge/level completion. Uses 8+ hooks simultaneously.    |
| **Dhikr Reader**     | `/dhikr/[categoryId]` (modal)      | Large Arabic text, tap-to-count area with pulse animation, prayer beads (33 dots), voice playback button, progress bar                                     | Base64 audio via `expo-av`. Progress saved per kid/category/date in AsyncStorage. Haptic feedback on every tap. Auto-advance after item completion (500ms). |
| **Challenges**       | `/(tabs)/challenges`               | 4 sub-tabs: Leaderboard, Weekly challenges, Friends, 1v1 Invite                                                                                            | Feature-flag-controlled tab visibility. Reactions: mashallah (🤩), keep (💪), love (❤️), dua (🤲). Chat history per friend (50 message limit).              |
| **Challenge Detail** | `/challenge/[challengeId]` (modal) | Large tap button with pulse + glow, live participant leaderboard, progress bar                                                                             | Real-time Supabase `postgres_changes` subscriptions. 4-second polling. Per-challenge `contribution` counter (not global).                                   |
| **Badges**           | `/(tabs)/badges`                   | Stats row (dhikr/streak/stars), wird status card, earned badges with glow, locked badges with progress                                                     | Evaluates badges on screen focus via `badgeService.evaluateBadges()`. Earned badges show gold glow + shadow.                                                |
| **Bedtime Mode**     | `/bedtime` (modal)                 | Dark calming UI (🌙), progress dots, large dhikr text, tap-to-count, "Good Night" completion                                                               | Fetches sleep category by key. Gentle pulse animation. Haptic success on all done.                                                                          |
| **Notifications**    | `/notifications` (modal)           | Filter pills (All/Unread/Read), notification list with type-specific icons/colors                                                                          | Paginated (20 per page), pull-to-refresh, `timeAgo()` display. 10+ notification types with unique colors.                                                   |
| **Edit Profile**     | `/edit-profile` (modal)            | Live preview, emoji grid / photo upload, name input                                                                                                        | `expo-image-picker` for camera/gallery. Custom base64→Uint8Array decoder. Uploads to `kid-avatars` Supabase Storage bucket.                                 |
| **Add Friend**       | `/add-friend` (modal)              | Own friend code card with share button, friend code input                                                                                                  | OS share sheet via `expo-sharing`. Self-add prevention.                                                                                                     |
| **Kid Settings**     | `/settings` (modal)                | Notification/sound/haptics toggles, subscription info, logout                                                                                              | AsyncStorage `@athkari_settings`. Linking to external URLs (privacy, terms).                                                                                |

### Parent-Facing Screens

| Screen              | Route                          | User Sees                                                                                                                        | Key Technical Detail                                                                                                     |
| ------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Kids Management** | `/(parent-dashboard)/kids`     | Per-kid cards with stats (stars/streak/wird), QR code display, voice profile picker, seasonal wird toggle, assign wird button    | `react-native-qrcode-svg` for QR generation. Voice profile modal. Seasonal wird manager. `useKidStats` for per-kid data. |
| **Monitor**         | `/(parent-dashboard)/monitor`  | Kid selector, 6-stat grid, wird status, 7-day bar chart, category progress breakdown                                             | Weekly data from `daily_goals` + `wird_logs` (past 7 days). Max/average/best-day/active-days computed client-side.       |
| **Friends**         | `/(parent-dashboard)/friends`  | Kid selector, friend code card, add friend input, pending requests (approve/reject), friend list with reactions + chat           | Parent can approve/reject friend requests. Chat modal shows reaction history. Remove friend with confirmation.           |
| **Plans**           | `/(parent-dashboard)/plans`    | Two tabs: Current (status badge, payment methods, invoices) / Change (plan selector, promo code)                                 | Stripe integration for invoices, payment methods, upcoming invoice. Cancel keeps access until period end.                |
| **Parent Settings** | `/(parent-dashboard)/settings` | Account info, change password modal, preferences (daily report, streak alerts), per-kid controls (allow friends/chat/challenges) | Per-kid AsyncStorage controls with keys like `allow_friends_{kidId}`. Supabase auth password update.                     |

### Shared / Utility

| Component        | Location                      | Purpose                                                                                             |
| ---------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| **AppGate**      | `components/AppGate.tsx`      | Blocks app with overlay if maintenance mode or force-update is active. Semantic version comparison. |
| **SplashScreen** | `components/SplashScreen.tsx` | Animated 2.2-second splash with logo glow, emoji particles, shimmer.                                |
| **Root Layout**  | `app/_layout.tsx`             | Provider chain: StripeProvider → LangProvider → AuthProvider → RootNavigator. Auth guard logic.     |

---

## 6. 💡 KEY TECHNICAL DECISIONS

### 1. Kid Authentication Without Email — Multi-Mode Login

Children don't have email addresses. The app implements three login modes:

- **PIN (4-digit):** Custom PinDots component with animated filled dots and spring feedback. Hash stored in `kids.pin_hash`.
- **QR Code:** Parent displays QR (from `kids.qr_token` with expiration), child scans with `expo-camera`. Zero typing required for young children.
- **OTP:** Push notification sent to parent's device with 6-digit code (5-minute expiry), child enters on their device.

Kid sessions are stored in AsyncStorage (not Supabase JWT) — the child never has a Supabase auth identity. This is a **deliberate child-safety decision** that keeps children's data under the parent's auth umbrella.

### 2. Content Integrity: 5-Stage Sharia Review Pipeline

Azkar content is not just fetched from a database — it passes through a formal review process: `draft → review → sheikh_review → approved → published`. The `sharia-transition` edge function **enforces valid transitions only** (e.g., you cannot jump from draft to published), records the reviewer, and appends to a JSON `status_history` audit trail. The `adhkar.sharia_status` field is filtered in every client query (`useAdhkar` hook). This ensures no unreviewed content reaches children — critical for an Islamic education app.

### 3. Dual Payment Provider Architecture (Stripe + RevenueCat)

The subscription system in `services/subscriptions.ts` abstracts over both Stripe (web/payment-sheet flow) and RevenueCat (native iOS/Android IAP). This addresses a real-world constraint: Apple requires App Store IAP for digital content on iOS, but Stripe may be preferred for web payments or Android. Both providers sync back to the same `families.billing_status` field via separate webhooks (`stripe-webhook` and `subscription-webhook`), so the app logic doesn't care which payment method was used.

### 4. Safe Social Layer — Pre-Set Reactions Only, No Freeform Chat

The friend system (`services/friends.ts`, `friend-manage` edge function) allows children to interact **only through 4 pre-set reactions**: `well_done` (🤩), `keep_going` (💪), `masha_allah` (❤️), `challenge_me` (🤲). There is no freeform text input. Friend requests require parent approval (`friend_requests.approved_by_parent`). Per-kid parental controls in AsyncStorage (`allow_friends_{kidId}`, `allow_chat_{kidId}`) give parents granular control. Chat history is capped at 50 messages. This is a thoughtful child-safety design that provides social motivation without moderation risk.

### 5. Optimistic Wird Completion with Offline-First Patterns

The `useWird` hook uses optimistic updates with ref-based state to prevent race conditions during rapid tapping. Daily category completion is cached in AsyncStorage (`completed-categories.ts`) with per-kid, per-day key rotation — so even without a network connection, a child can see which categories they completed today. SWR's stale-while-revalidate pattern means the UI is always responsive: data shows immediately from cache while fresh data loads in the background.

### 6. Timezone-Aware Push Notification System

Rather than sending all scheduled notifications at once (which would wake up a child at 3 AM in a different timezone), the `push-scheduled` edge function evaluates `notification_templates` per timezone. Device tokens are geo-tagged with timezone (via IP detection at registration — `services/notifications.ts` uses 3 IP APIs with fallback: ipapi.co → freeipapi.com → ipwho.is). The `notification_template_tz_log` table ensures deduplication — each template is sent once per timezone per day.

---

## 7. 🔒 SUBSCRIPTION & MONETIZATION FLOW

### Free vs. Paid

| Feature               | Free (Trial/Churned)        | Paid (Active)                  |
| --------------------- | --------------------------- | ------------------------------ |
| Basic Azkar content   | ✅ All categories           | ✅ All categories              |
| Daily goal tracking   | ✅                          | ✅                             |
| Streak tracking       | ✅                          | ✅                             |
| Number of kids        | 1                           | 3 or 5 (per plan)              |
| Friends               | 1 friend max                | Up to 30                       |
| Challenges            | ⚠️ Limited by feature flags | ✅ Full access                 |
| AI Voice recitation   | ❌                          | ✅                             |
| Wird (daily programs) | ⚠️ Basic                    | ✅ Full with seasonal + custom |
| Parent analytics      | ⚠️ Basic                    | ✅ Full dashboard              |

### How Subscription Status Is Checked

1. **Primary source:** `families.billing_status` in Supabase (values: `trial`, `active`, `past_due`, `churned`, `suspended`)
2. **Sync mechanism:** Two webhooks keep this field current:
   - **Stripe webhook** (`stripe-webhook` edge function): Handles `customer.subscription.created/updated/deleted` and `invoice.payment_succeeded/failed` events. Maps Stripe subscription status directly to `billing_status`.
   - **RevenueCat webhook** (`subscription-webhook` edge function): Maps RevenueCat product IDs to plan IDs and updates `billing_status/plan_id/billing_cycle/max_kids`.
3. **Client check:** `useFeatureFlags` hook reads family data (loaded in `AuthContext`) and checks `billing_status` to determine feature availability.
4. **Database check:** `subscriptions.checkSubscriptionDB()` queries `families` directly for real-time billing verification.

### Subscription Purchase Flow

1. User selects plan in `(auth)/plans.tsx` or `(parent-dashboard)/plans.tsx`
2. Optionally enters promo code → validated via `plansService.validatePromoCode()`
3. **Stripe path:**
   - `stripeService.createCheckout()` calls `create-payment-intent` edge function
   - Edge function creates/fetches Stripe customer, creates subscription with trial, resolves product/price
   - Returns `client_secret` + `ephemeralKey` + `customer_id`
   - `stripeService.initializePaymentSheet()` → `presentPaymentSheet()` (native Stripe UI)
   - On success: Stripe sends webhook → `stripe-webhook` updates `families`
4. **RevenueCat path:**
   - `subscriptionService.purchase()` calls RevenueCat SDK directly
   - On success: RC sends webhook → `subscription-webhook` updates `families`

### What Happens When a Subscription Expires

1. Stripe sends `customer.subscription.deleted` or `invoice.payment_failed` event
2. `stripe-webhook` edge function sets `families.billing_status` to `churned` or `past_due`
3. On next app launch, `AuthContext` loads updated family data
4. `useFeatureFlags` recalculates feature access based on new status
5. Features are gracefully limited (not abruptly removed):
   - Extra kids beyond limit become inaccessible (not deleted)
   - Friend list persists but new additions are blocked
   - Voice playback stops working
   - Subscription management screen shows "Resubscribe" option
6. `manage-subscription` edge function supports `resume` action for re-activation

### Revenue Analytics

The `analytics-aggregate` edge function provides admin KPIs:

- **MRR** (Monthly Recurring Revenue)
- **ARR** (Annual Recurring Revenue)
- **Active users** count
- **Trial conversion rate**
- **Churn rate**
- **Active kids today**

---

## 8. ✅ WHY THIS PROJECT IS WELL-BUILT

### Paragraph 1: Architecture Quality and Scalability

"The Athkari codebase demonstrates mature software architecture principles. The application is organized into a clean separation of concerns: 28 screens handle UI presentation, 19 custom hooks manage data fetching with SWR caching and real-time Supabase subscriptions, 17 service modules encapsulate business logic, and 22 edge functions handle server-side operations and external API integrations. Row Level Security is enabled across all 31 database tables with 40+ policies and helper functions, ensuring data isolation at the database level — not just the application level. The 13 incremental SQL migrations demonstrate a disciplined approach to schema evolution. The dual-provider payment architecture (Stripe + RevenueCat) with webhook-driven status synchronization means the billing system is resilient and platform-compliant. The codebase is fully typed with TypeScript, with domain-specific types like `BillingStatus`, `ShariaStatus`, and `AgeGroup` enforcing correctness at compile time. This architecture can support significant growth — from hundreds to tens of thousands of families — without structural changes."

### Paragraph 2: Why This Tech Stack Is the Right Fit

"Every technology choice in this project was made with the specific product in mind. Expo and React Native deliver a single codebase for both iOS and Android — essential for a niche market app where maintaining two native codebases would double development cost without business justification. Supabase's PostgreSQL foundation provides the relational data model needed for complex family-kid-friend-challenge relationships, while its Row Level Security, real-time subscriptions, edge functions, and storage eliminate the need for a separate backend server. SWR ensures the children's interface feels instant — data loads from cache immediately while fresh data syncs in the background. The animation stack (React Native Reanimated, Linear Gradient, Haptics) creates the polished, tactile experience that differentiates a children's app from an adult tool. And the Stripe + RevenueCat dual-provider setup ensures we can process payments through whatever channel each platform requires, while maintaining a single source of truth for subscription status."

### Paragraph 3: User Experience Decisions for Children and Parents

"The user experience decisions throughout this codebase demonstrate a deep understanding of both user groups. For children: the app uses large tap targets with spring-based haptic feedback on every interaction, animated celebrations for completions (confetti particles, level-up overlays, badge unlocks), a tiered streak system with visual flame emoji and milestone rewards, and a night-sky color palette that feels like a game rather than a study tool. Authentication requires no email — kids log in via PIN, QR code, or parent-approved OTP. The social layer is built for safety: only 4 pre-set reactions (no freeform chat), friend requests require parental approval, and parents have per-child toggles for friends, chat, and challenges. For parents: the warm-toned dashboard provides weekly bar charts, category breakdowns, wird completion tracking, and QR code generation — giving full visibility into their child's Islamic education practice without being intrusive. The Sharia review pipeline (5 stages with audit trail) ensures every piece of content children see has been formally reviewed and approved, building trust with religiously observant families. This combination of child engagement, parental control, and content integrity is what makes Athkari not just a well-built app, but the right app for its audience."

---

_End of Technical Briefing_

_File count: 80+ source files | Tables: 31 | Edge Functions: 22 | Hooks: 19 | Services: 17 | Components: 27 | Screens: 28 | Translation keys: ~400+ | Migrations: 13_
