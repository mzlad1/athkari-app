# Athkari Admin Dashboard — Technical Briefing Document

**Prepared for:** Stakeholder Meeting  
**Date:** March 14, 2026  
**Version:** 1.0  
**Codebase Scanned:** Full admin panel — 16 pages, 7 shared components, 9 hooks, 16 services, 1 context, 20+ Supabase tables queried, 2 edge functions invoked

---

## 1. 📱 DASHBOARD OVERVIEW

### What Is This Admin Panel?

The Athkari Admin Dashboard is an **internal operations panel** built with Vite + React that gives the team full control over every aspect of the Athkari children's Azkar mobile app — content, users, subscriptions, gamification, notifications, and system configuration — without touching code or deploying updates.

It connects to the **same Supabase backend** as the mobile app, using a **service-role key** that bypasses Row Level Security (RLS) to provide unrestricted read/write access to all 31 database tables.

### Who Uses It?

The dashboard is designed for **six distinct admin roles**, defined in [athkari-admin/src/services/security.ts](athkari-admin/src/services/security.ts) as the `ROLE_TABS` constant:

| Role            | Label           | Accessible Tabs                              | Typical User             |
| --------------- | --------------- | -------------------------------------------- | ------------------------ |
| **super_admin** | Super Admin     | `"*"` (all 15 tabs)                          | CTO / Lead Developer     |
| **content_mgr** | Content Manager | `dashboard`, `content`, `wird`, `onboarding` | Content team lead        |
| **reviewer**    | Reviewer        | `review`                                     | Islamic scholar (Sheikh) |
| **support**     | Support         | `dashboard`, `users`, `push`                 | Customer support agent   |
| **analyst**     | Analyst         | `dashboard`                                  | Business analyst         |
| **viewer**      | Viewer          | `dashboard`                                  | Stakeholder / observer   |

### What Can Each Role Do vs. Not Do?

- **super_admin:** Full CRUD on all entities — categories, adhkar, badges, levels, challenges, plans, promo codes, wird templates, voice profiles, notification templates, onboarding screens, app config, admin users. Can manage other admins and view the full audit log.
- **content_mgr:** Can create/edit/delete adhkar, categories, wird templates, and onboarding screens. Cannot manage subscriptions, users, badges, challenges, or system settings.
- **reviewer:** Sees only the Sharia Review queue. Can approve, reject, or request revision on adhkar. Cannot create or delete content.
- **support:** Can view the dashboard KPIs, browse/search families and kid profiles (with impersonation), and send push notifications. Cannot modify content or system config.
- **analyst:** Read-only access to the dashboard KPIs. Cannot perform any actions.
- **viewer:** Same as analyst — read-only dashboard access.

### Relationship to the Mobile App

The admin dashboard and the mobile app are **two clients of the same Supabase project**:

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Mobile App      │     │  Supabase Backend    │     │  Admin Dashboard │
│  (Expo/RN)       │────▶│  PostgreSQL + Auth   │◀────│  (Vite/React)    │
│  anon key + RLS  │     │  Edge Functions       │     │  service_role    │
│                  │     │  Storage              │     │  (bypasses RLS)  │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
```

- Changes made in the dashboard (e.g., publishing an adhkar, toggling maintenance mode, creating a challenge) are **immediately visible** to mobile app users.
- The mobile app uses the **anon key** with RLS enforcement; the admin dashboard uses the **service_role key** with RLS bypassed.
- Both share the same database tables, storage buckets, and edge functions.

---

## 2. 🛠️ TECHNOLOGY STACK — WITH JUSTIFICATION

### Core Framework

| Technology     | Version | What It Is                 | Why It's Right for an Admin Dashboard                                                                                                                                                                                                            |
| -------------- | ------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vite**       | ^5.4.0  | Next-generation build tool | Instant HMR and sub-second cold starts. Admin dashboards are internal tools — Vite's speed-focused DX reduces developer friction. No SSR needed (no SEO concerns for an internal panel), so Next.js would be over-engineered. CRA is deprecated. |
| **React**      | ^18.3.0 | Component-based UI library | Matches the mobile app's React Native foundation, allowing shared mental models and type definitions. React 18's concurrent rendering handles the data-heavy tables and forms smoothly.                                                          |
| **TypeScript** | ^5.5.0  | Typed JavaScript           | The admin dashboard shares type definitions with the mobile app (e.g., `ShariaStatus`, `BillingStatus`, `AdminRole`). Type safety prevents admin-side bugs that could corrupt production data.                                                   |

### Backend Connection

| Technology                | Version | What It Is              | Why It's Right                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@supabase/supabase-js** | ^2.45.0 | Supabase client library | Same library version as the mobile app. The admin panel creates **two Supabase clients** in [athkari-admin/src/services/supabase.ts](athkari-admin/src/services/supabase.ts): (1) `supabase` with the **service_role key** (bypasses RLS for unrestricted admin access, sessions disabled), and (2) `supabaseAuth` with the **anon key** (for Supabase Auth login flows). This dual-client pattern ensures admin auth works through Supabase Auth while data operations bypass RLS. |

### Data Fetching

| Technology | Version | What It Is                           | Why It's Right                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SWR**    | ^2.2.0  | Stale-while-revalidate data fetching | Same library used in the mobile app hooks. Provides automatic cache + revalidation for admin screens — when an admin edits a badge and navigates away then back, the data is fresh. All 9 admin hooks (`useBadges`, `useCategories`, `useChallenges`, `useConfig`, `useLevels`, `usePlans`, `useFamilies`, `useVoiceProfiles`, `useWirdTemplates`) use SWR. |

### UI & Interaction

| Technology                     | Version | What It Is                          | Why It's Right                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Custom CSS** (no UI library) | —       | Hand-written CSS with design tokens | The dashboard uses no external UI component library (no MUI, Ant Design, or Chakra). All components are custom-built in [athkari-admin/src/components/shared.tsx](athkari-admin/src/components/shared.tsx) (`Card`, `DataTable`, `ActionBtn`, `KPICard`, `CfgRow`, `StatusBadge`, `Pagination`). This keeps the bundle tiny and the styling consistent with the Athkari brand's night-sky aesthetic (CSS variables: `--midnight`, `--deep`, `--gold`, `--teal`, `--violet`). |
| **@hello-pangea/dnd**          | —       | Drag-and-drop library               | Fork of react-beautiful-dnd (maintained). Used in [Plans.tsx](athkari-admin/src/pages/Plans.tsx) for drag-and-drop plan reordering and implicitly available for other sortable lists (badges, levels, onboarding screens).                                                                                                                                                                                                                                                   |
| **Tailwind CSS**               | —       | Utility-first CSS framework         | Listed in devDependencies (`tailwindcss`, `postcss`, `autoprefixer`). Available as a utility layer alongside the custom CSS design system for rapid layout adjustments.                                                                                                                                                                                                                                                                                                      |

### Other Notable Packages

| Package                  | Purpose                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **qrcode.react**         | QR code generation — used for generating kid login QR codes within the Users page context |
| **@vitejs/plugin-react** | Vite plugin for React JSX transform and Fast Refresh                                      |

### What's Intentionally NOT Included

- **No routing library** (React Router, TanStack Router) — The dashboard uses a **single-page tab-based architecture** managed by state in [App.tsx](athkari-admin/src/App.tsx) via `useState("tab")`. This is a deliberate simplification — an internal admin tool doesn't need URL-based routing, deep linking, or bookmarkable pages.
- **No chart library** (Recharts, Chart.js) — Dashboard KPIs use custom `KPICard` components, and the Revenue page uses CSS-based horizontal bar charts. ⚠️ This means charts are static or hardcoded; a charting library could be a future addition.
- **No form library** (React Hook Form, Formik) — Forms are managed with `useState` per page. Given the moderate form complexity, this keeps things simple.

---

## 3. 🏗️ ARCHITECTURE & STRUCTURE

### Full Folder Structure

```
athkari-admin/
├── src/
│   ├── App.tsx                    # Entry: auth flow, tab routing, role gate
│   ├── main.tsx                   # React 18 createRoot entry
│   ├── index.css                  # Global CSS: buttons, badges, forms, inputs
│   ├── components/
│   │   ├── Layout.tsx             # Sidebar + content shell, role-filtered tabs
│   │   └── shared.tsx             # 7 reusable components (Card, DataTable, etc.)
│   ├── contexts/
│   │   └── AdminContext.tsx        # React Context for current admin user
│   ├── hooks/                     # 9 SWR data-fetching hooks
│   │   ├── useBadges.ts           # → badgesService.getAll()
│   │   ├── useCategories.ts       # → categoriesService.getAll()
│   │   ├── useChallenges.ts       # → challengesService (3 hooks: community, 1v1, templates)
│   │   ├── useConfig.ts           # → configService.getAll() + updateConfig()
│   │   ├── useLevels.ts           # → levelsService.getAll()
│   │   ├── usePlans.ts            # → plansService.getAll()
│   │   ├── useUsers.ts            # → usersService.getFamilies() (paginated + filtered)
│   │   ├── useVoice.ts            # → voiceService (profiles + files)
│   │   └── useWird.ts             # → wirdService (4 hooks: templates, adhkar, custom)
│   ├── pages/                     # 16 admin pages (one per tab + extras)
│   │   ├── Dashboard.tsx          # KPIs, recent families, top kids
│   │   ├── Users.tsx              # Family browser, kid impersonation
│   │   ├── Content.tsx            # Categories + adhkar CRUD, voice management
│   │   ├── Voice.tsx              # Voice profiles + TTS file management
│   │   ├── Wird.tsx               # Wird template editor (seasonal + custom)
│   │   ├── Review.tsx             # Sharia review queue
│   │   ├── Onboarding.tsx         # Onboarding screen editor with live preview
│   │   ├── Gamify.tsx             # Badge CRUD with criteria + reordering
│   │   ├── Levels.tsx             # Level editor with gradient preview
│   │   ├── Challenges.tsx         # Challenge templates + community/1v1 management
│   │   ├── Plans.tsx              # Subscription plans + promo codes
│   │   ├── Push.tsx               # Notification templates + send + history
│   │   ├── Referrals.tsx          # Referral tracking (read-only)
│   │   ├── Revenue.tsx            # Revenue analytics (⚠️ hardcoded demo data)
│   │   ├── Settings.tsx           # App config: maintenance, feature flags, limits
│   │   ├── Security.tsx           # Admin user CRUD + audit log viewer
│   │   └── styles/                # Per-page CSS files (16 files)
│   ├── services/                  # 16 service modules (Supabase queries)
│   │   ├── supabase.ts            # Dual client: service_role + anon auth
│   │   ├── analytics.ts           # Dashboard KPIs (6 parallel queries)
│   │   ├── badges.ts              # CRUD + reorder + stats
│   │   ├── categories.ts          # Category + adhkar CRUD
│   │   ├── challenges.ts          # Templates + challenges + participants
│   │   ├── config.ts              # app_config key-value CRUD
│   │   ├── levels.ts              # Level CRUD + kid reassignment
│   │   ├── onboarding.ts          # Screen CRUD + reorder
│   │   ├── plans.ts               # Plan CRUD
│   │   ├── promos.ts              # Promo code CRUD
│   │   ├── push.ts                # Templates + send (edge function) + history
│   │   ├── referrals.ts           # Read-only referral stats
│   │   ├── security.ts            # Admin CRUD + audit log + ROLE_TABS
│   │   ├── users.ts               # Families + kids (paginated, filtered, impersonate)
│   │   ├── voice.ts               # Profiles + files + ElevenLabs generation
│   │   └── wird.ts                # Templates + custom items + kid assignments
│   └── types/
│       └── database.ts            # Shared types, enums, constants, role definitions
├── public/                        # Static assets
├── .env.example                   # VITE_SUPABASE_URL, ANON_KEY, SERVICE_KEY
├── package.json                   # Dependencies
├── vite.config.ts                 # Vite config with @ alias
├── tsconfig.json                  # TypeScript config (ES2020, strict)
└── index.html                     # HTML entry point
```

### Organization Pattern

The dashboard follows a **page-based architecture with a service layer**:

1. **Pages** are self-contained: each page manages its own state, forms, modals, and CRUD flows
2. **Hooks** provide SWR-cached data fetching (one hook per domain)
3. **Services** encapsulate all Supabase queries (one service per domain)
4. **Components** provide shared UI primitives (`Card`, `DataTable`, `ActionBtn`, `KPICard`, `CfgRow`, `StatusBadge`, `Pagination`)
5. **Context** provides the current admin user globally

### How It Connects to Supabase

From [athkari-admin/src/services/supabase.ts](athkari-admin/src/services/supabase.ts):

```
Two Supabase clients:

1. `supabase` (service_role) — Used by ALL service modules
   - Key: VITE_SUPABASE_SERVICE_KEY (fallback: VITE_SUPABASE_ANON_KEY)
   - Auth: { persistSession: false, autoRefreshToken: false }
   - Purpose: Bypasses RLS for unrestricted admin data access

2. `supabaseAuth` (anon key) — Used ONLY in App.tsx for login
   - Key: VITE_SUPABASE_ANON_KEY
   - Purpose: Supabase Auth sign-in (email/password)
```

This dual-client approach is critical: the admin logs in through Supabase Auth (which needs the anon key), but all data operations use the service_role key to bypass RLS.

### Authentication Flow

Defined in [athkari-admin/src/App.tsx](athkari-admin/src/App.tsx):

1. **On mount:** `supabaseAuth.auth.getSession()` checks for existing session
2. **Login:** Admin enters email + password → `supabaseAuth.auth.signInWithPassword()`
3. **Verification:** `securityService.getAdminByEmail(email)` queries `admin_users` table — if no active record found, access is denied even with valid Supabase Auth credentials
4. **Session listener:** `supabaseAuth.auth.onAuthStateChange()` re-verifies on every auth state change
5. **Role enforcement:** `getAllowedTabs(adminUser.role)` uses the `ROLE_TABS` constant to determine visible sidebar tabs
6. **Logout:** `supabaseAuth.auth.signOut()` clears session and admin state

**Two-layer security model:**

- Layer 1: Supabase Auth (email/password) — must have a valid Supabase user
- Layer 2: `admin_users` table — must have an active record with a role

⚠️ **TOTP/2FA:** The `admin_users` table has a `totp_secret` column (from the mobile app's schema), but the admin dashboard **does not currently implement TOTP verification** in its login flow. The login is email/password only.

### Role-Based Access Control (RBAC) in the UI

RBAC is enforced at **three levels**:

1. **App.tsx** — `getAllowedTabs(role)` filters which tabs appear in the sidebar
2. **Layout.tsx** — The `allowedTabs` prop filters the sidebar navigation; tabs not in the list are hidden
3. **Page-level** — Each page receives the admin context via `useAdmin()` and can conditionally render actions (e.g., only super_admin sees delete buttons on Security page)

The `ROLE_TABS` mapping from [athkari-admin/src/services/security.ts](athkari-admin/src/services/security.ts):

```typescript
const ROLE_TABS = {
  super_admin: "*", // all 15 tabs
  content_mgr: ["dashboard", "content", "wird", "onboarding"],
  reviewer: ["review"],
  support: ["dashboard", "users", "push"],
  analyst: ["dashboard"],
  viewer: ["dashboard"],
};
```

---

## 4. 📲 PAGES & FEATURES

### Auth Pages

| Page      | Route/Tab           | What Admin Sees & Does                                     | Key Technical Detail                                                                                                                                          |
| --------- | ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login** | (inline in App.tsx) | Email + password form with "Sign in" button, error display | `supabaseAuth.auth.signInWithPassword()` → `securityService.getAdminByEmail()` verification. No separate login page — rendered conditionally when `!session`. |

⚠️ No dedicated 2FA/TOTP page exists despite the `totp_secret` column in `admin_users`.

### Content Management

| Page           | Tab          | What Admin Sees & Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Key Technical Detail                                                                                                                                                                                                            |
| -------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Content**    | `content`    | **Categories view:** Card grid of all categories with icon, titles (EN/AR), edit + delete. **Adhkar view:** Table of all adhkar in selected category with drag-and-drop reorder, status filter pills (pending/reviewed/approved/needs_revision/rejected), inline voice status. **Category editor:** name_en, name_ar, emoji icon picker (40 emojis), gradient color pickers. **Dhikr editor:** text_ar, meaning_ar, meaning_en, repetition_count, points, category dropdown, sharia_status, review_note, reviewer, voice profile picker, voice generation/upload. | Tables: `categories`, `adhkar`, `voice_profiles`, `voice_files`. Voice generation calls `voice-generate` edge function. Audit logged via `securityService.logAudit()`. Custom `EmojiPicker` and `DhikrSearchPicker` components. |
| **Voice**      | `voice`      | **Profiles tab:** Profile table (name EN/AR, source badge, file count, active status), inline create/edit form, test voice button (generates Bismillah sample). **Files tab:** Profile selector dropdown, two sections — "Has Audio" (with HTML5 audio player, regenerate/delete) and "Missing Audio" (with generate/upload buttons).                                                                                                                                                                                                                             | Tables: `voice_profiles`, `voice_files`, `adhkar`. Edge function: `voice-generate` (ElevenLabs TTS `eleven_multilingual_v2`). Storage bucket: `voice-files` at path `{profileId}/{adhkarId}.mp3`. Audit logged.                 |
| **Wird**       | `wird`       | **Template list:** Table with name, age group badge, dhikr count, reward stars, status flags (default/active/seasonal), edit + delete. **Template editor:** Names, age group dropdown, reward stars, default/active/seasonal checkboxes, celebration picker (8 types). **Seasonal schedule:** Date range, card icon picker (28 emojis), gradient + accent color pickers. **Dhikr selector:** Dual tab — Library (search + checkbox from `adhkar` table) or Custom (add free-text Arabic/English items).                                                           | Tables: `wird_templates`, `adhkar`, `kids` (seasonal_custom_items, custom_adhkar_ids). `wirdService.getKidsCustomItems()` fetches all kids and filters client-side for JSONB arrays. Audit logged.                              |
| **Review**     | `review`     | **Sharia Review queue** — see Section 5 below                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Tables: `adhkar`. Status transitions enforced in UI.                                                                                                                                                                            |
| **Onboarding** | `onboarding` | **Screen list:** Table with order #, icon emoji, titles (EN/AR stacked), description preview, active badge, reorder arrows (↑↓), edit + delete. **Editor (split layout):** Left panel = English content card (title + description), Arabic content card (RTL), settings card (emoji picker, display order, active checkbox). **Right panel = Live phone preview** with notch mockup showing illustration, titles, descriptions, and dot indicators.                                                                                                               | Tables: `onboarding_screens`. Custom `PhonePreview` component renders real-time mobile mockup. `IllustrationPicker` with 24 Islamic/nature emojis. Reorder via `onboardingService.reorder()`. Audit logged.                     |

### User Management

| Page      | Tab     | What Admin Sees & Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Key Technical Detail                                                                                                                                                                                                                                      |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Users** | `users` | **Family table:** Columns = parent (name + email + avatar), kids (avatar chips), plan, billing status badge, country flag, joined date. Filters: status pills (all/active/trial/churned), search by name/email. Pagination: 20/page server-side. **Side panel (on row click):** Banner with parent info + billing badge, meta strip (country, joined, kid count), kids list (avatar, name, age, friend code, stars, streak), subscription details (status, plan, cycle, prices, trial/period end, Stripe IDs). **Kid impersonation (on 👁️ click):** Full-page view showing KPI strip (stars, streak, total_adhkar, daily_goal), badges grid (icon + name from `kid_badges`→`badges`), wird logs table (date, complete ✅/❌, items count, bonus). | Tables: `families`, `kids`, `plans`, `kid_badges`, `badges`, `wird_logs`, `wird_templates`. `useFamilies()` hook with SWR + server-side pagination. `usersService.impersonateKid()` deep-joins all kid data. No write operations — read-only exploration. |

### Gamification Management

| Page           | Tab          | What Admin Sees & Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Key Technical Detail                                                                                                                                                                                                                                   |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Gamify**     | `gamify`     | **Badge list:** Drag-and-drop reorderable table with drag handle (⠿), icon, names (EN/AR), criteria badge (color-coded by type), threshold (≥ value), active status, edit + delete. **Badge editor:** Icon hero with emoji picker (40+ emojis), names, criteria type dropdown (📿 dhikr_count, 🔥 streak, ⭐ stars, 📋 wird_count, 📂 category_count, 👥 friend_count), threshold number, active checkbox, live preview. **Config section:** Points per dhikr (default 5), points per category (25), wird completion bonus (50), celebration triggers, leaderboard settings (scoring, reset, scope, min age, max daily). | Tables: `badges`, `kid_badges` (for stats), `app_config`. Drag-and-drop updates `display_order` via `badgesService.reorder()`. Badge stats show award counts per badge. Gamification config uses `useConfig()` + `configService`. Audit logged.        |
| **Levels**     | `levels`     | **Levels table:** Level number, emoji, titles (EN/AR), stars required, kid count per level. **Level editor:** Emoji hero with gradient preview + emoji picker (40 emojis), level number, stars required, titles, two color pickers (gradient start/end), live preview card. **Delete confirmation modal:** Warning if kids exist on level, dropdown to select reassignment target level, "Reassign & Delete" button.                                                                                                                                                                                                     | Tables: `levels`, `kids` (for level stats). `levelsService.getLevelStats()` counts kids per level. `levelsService.deleteAndReassign()` moves kids to lower level before deletion. Audit logged.                                                        |
| **Challenges** | `challenges` | **Three sections:** Challenge templates table (name, type, goal, duration, rewards, status), community challenges table, 1v1 challenges list. **Template editor:** Names (EN/AR), descriptions, type radio (1v1/community), dhikr picker (search existing or type custom text), goal/duration/reward numbers, celebration picker (8 types), active toggle. **Community challenge editor:** Extends template fields with 2nd/3rd place rewards, status dropdown (active/completed/scheduled), start/end dates, progress counter. **Fill from template** button copies template fields into new challenge.                 | Tables: `challenge_templates`, `challenges`, `challenge_participants`, `adhkar`. Custom `CelebPicker` component with 8 celebration types. Custom `DhikrPicker` for adhkar search. Cascade delete: removes participants before challenge. Audit logged. |

### Subscription & Billing Management

| Page        | Tab       | What Admin Sees & Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Key Technical Detail                                                                                                                                                                                                                         |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plans**   | `plans`   | **Three sub-tabs:** Plans, Promos, Config. **Plans tab:** Drag-and-drop list (via `@hello-pangea/dnd`) with name, max kids, monthly/annual prices, features chip grid, active status. **Plan editor:** Names, max kids, trial days, pricing, tag ("Popular"/"Best Value"), feature toggle grid (adhkar, wird, badges, friends, challenges, ai_voice, bedtime, reports), active checkbox. **Promos tab:** Table with code, discount type (% or $), value, valid dates, max/current uses, active status. **Promo editor:** Code (uppercase), type dropdown, value, date range, max uses, plan filter, active checkbox. | Tables: `plans`, `promo_codes`. `@hello-pangea/dnd` library for plan reordering. Feature flags stored as JSONB `features` array on plans. Audit logged.                                                                                      |
| **Revenue** | `revenue` | **KPI cards:** MRR ($18,450), ARR ($221,400), Active Subscriptions (920), Monthly Churn (3.0%). **MRR Growth chart:** CSS horizontal bar chart showing 5 months of MRR + net growth. **Revenue by Plan:** Percentage breakdown (3 Kids: 52%, 5 Kids: 31%, 1 Child: 17%). **Revenue by Region:** 6 countries with flag emojis and percentages.                                                                                                                                                                                                                                                                        | ⚠️ **All data is hardcoded** — `MRR_DATA` is a static array in the component. Does NOT call `analyticsService` or the `analytics-aggregate` edge function. This is demo/placeholder data for presentation purposes. No export functionality. |

### Analytics & Reporting

| Page          | Tab         | What Admin Sees & Does                                                                                                                                                                                                                                                                                                                                                                                                                 | Key Technical Detail                                                                                                                                                                                                                                                                             |
| ------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dashboard** | `dashboard` | **KPI Row 1:** Total Families, Total Kids, Adhkar Today, Active Challenges (with emoji icons). **KPI Row 2:** Active Kids (7d), Wird Done Today, Badges Earned, Friendships. **Recent Families table:** 10 most recent families (name, email, country flag, billing badge, kid count, joined date). **Top Kids table:** 10 highest-performing kids (avatar, name, stars ⭐, streak 🔥, total adhkar). Refresh button reloads all data. | `analyticsService.getDashboardKPIs()` runs 6 parallel Supabase queries across `families`, `kids`, `challenges`, `kid_badges`, `daily_goals`, `wird_logs`, `friendships`. Uses exact counts. 7-day active kids window. `getRecentFamilies(10)` joins kids. `getTopKids(10)` orders by stars DESC. |
| **Referrals** | `referrals` | **KPI strip:** Total Referrals (🔗), Stars Awarded (⭐). **History table:** Referrer kid (avatar + name + friend_code badge), new kid (avatar + name), stars awarded (⭐ 50 fixed), date. Pagination: 20/page.                                                                                                                                                                                                                         | `referralsService.getAll()` queries `kids` WHERE `referred_by IS NOT NULL`, then batch-fetches referrer details. Stars awarded calculated as `total * 50`. Read-only.                                                                                                                            |

### System & Configuration

| Page         | Tab        | What Admin Sees & Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Key Technical Detail                                                                                                                                                                                                                                                 |
| ------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Settings** | `settings` | **Feature Flags card:** Toggle buttons for 6 flags: challenges, friends, wird, leaderboard, referrals, 1v1. Each toggle immediately calls `useConfig().updateConfig("feature_flags", {...})`. **App Configuration card (batch save):** Maintenance mode toggle, maintenance message (text), min app version (e.g. "1.0.0"), force update toggle, default language (ar/en dropdown), max friends per kid (number). Save button applies all changes at once. Shows "✓ Saved" badge for 2.5s.                                                                                                                                                                                                                                                                     | Table: `app_config` (key-value JSONB). Feature flags saved as single JSON object under key `feature_flags`. Batch save iterates `configService.set(key, value, adminId)` for each changed field. `CfgRow` component handles toggle/text/number/select types.         |
| **Security** | `security` | **Three sub-tabs:** Admins, Audit, Roles. **Admins tab:** Table with name (+ email), role badge (color-coded), active status. New admin button. **Admin editor modal:** Name, email, role dropdown (6 roles), role hint showing accessible tabs, active checkbox. **Audit tab:** Paginated log (20/page) with columns: time, admin name, action badge (CREATE/UPDATE/DELETE/SEND with color coding), entity type, entity ID, IP address, "Details" button. **Audit detail modal:** Shows action badge, entity info, admin name, time, IP. For updates: diff table showing Field/Before/After with row highlighting (added=green, removed=red, changed=yellow). For creates: single-side "Created value" table. For deletes: single-side "Deleted value" table. | Tables: `admin_users`, `audit_log`. `securityService.getAuditLog(page)` paginated 20/page. Audit detail modal parses `old_value` and `new_value` JSONB to show field-by-field diffs. `AdminRole` type: super_admin, content_mgr, reviewer, support, analyst, viewer. |
| **Push**     | `push`     | **Three sub-tabs:** Templates, History, Send. **Templates tab:** List with icon, name, title preview, segment, schedule status. **Template editor:** Emoji picker (40 notification emojis), name, titles (EN/AR), bodies (EN/AR textareas, AR is RTL), segment dropdown (everyone/subscribers/inactive 3+ days/parents), schedule section (time picker, frequency dropdown — daily/weekdays/fri/sat_sun, timezone multi-select with presets: All/Gulf/Levant). **Send tab:** Template selector, segment selector, timezone multi-select, Send button. **History tab:** Paginated table (20/page) with timestamp, segment, status, count sent.                                                                                                                  | Tables: `notification_templates`, `notifications`. Schedule format: `"HH:MM                                                                                                                                                                                          | FREQ | TZ1,TZ2,TZ3"`. Parser/builder helpers: `parseSchedule()`and`buildSchedule()`. Send calls `pushService.send()`which invokes the`push-send` edge function via HTTP POST. 9 Middle Eastern/African timezones defined (Palestine, Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman, Egypt, Jordan). Audit logged. |

---

## 5. 🔒 SHARIA REVIEW WORKFLOW

This is implemented in [athkari-admin/src/pages/Review.tsx](athkari-admin/src/pages/Review.tsx) and is one of the most critical pages in the dashboard.

### How Content Enters Review

1. A **content_mgr** creates or edits an adhkar in the Content page, setting its `sharia_status` to `"pending"` (or the default on creation)
2. The adhkar appears in the Review queue, filtered by status

### The 5-Stage Pipeline

Defined in [athkari-admin/src/types/database.ts](athkari-admin/src/types/database.ts) as `SHARIA_FLOW`:

```
draft → review → sheikh_review → approved → published
```

Each stage has defined colors and labels in `SHARIA_COLORS`:

| Status          | Color  | Badge         | Meaning                             |
| --------------- | ------ | ------------- | ----------------------------------- |
| `draft`         | Gray   | Draft         | Initial creation, not yet submitted |
| `review`        | Blue   | Review        | Submitted for internal review       |
| `sheikh_review` | Gold   | Sheikh Review | Sent to Islamic scholar             |
| `approved`      | Green  | Approved      | Scholar approved content            |
| `published`     | Purple | Published     | Live in the mobile app              |

Additional review states (from `AdhkarReview` type):

- `pending` — Awaiting review
- `needs_revision` — Reviewer requested changes (orange badge)
- `rejected` — Reviewer rejected content (red badge)

### What the Reviewer Sees

The Review page shows:

1. **Status filter pills** at the top with item counts: All, Pending (⏳), Reviewed (👁️), Approved (✅), Needs Revision (✏️), Rejected (❌)
2. **Expandable adhkar list** — each item shows status badge, category icon, Arabic text preview
3. **Expanded detail view:**
   - **Read mode:** Full Arabic text, English meaning, metadata (category, repetition count, points, Arabic meaning), "Edit Dhikr" button
   - **Edit mode:** Editable fields for text_ar, meaning_ar, meaning_en, repetition_count, points
   - **Review info box:** "Reviewed by" label, notes textarea for reviewer comments
   - **Action buttons:** Approve (✅), Needs Revision (✏️), Reject (❌) — context-aware based on current status

### How Status Transitions Work

When a reviewer clicks an action button:

1. `categoriesService.updateDhikr(id, { sharia_status: "approved" | "needs_revision" | "rejected", reviewer_id: adminUser.name, review_note: note })` is called
2. The `reviewer_id` is set to the current admin's name/email
3. The review note is persisted

⚠️ **The UI does not enforce the strict 5-stage sequential pipeline** (draft → review → sheikh_review → approved → published). Status transitions in the Review page allow jumping directly between `approved`, `needs_revision`, and `rejected`. The strict pipeline enforcement exists in the **`sharia-transition` edge function** (from the mobile app's backend), but the admin Review page uses direct `updateDhikr` calls. The status_history audit trail is **not displayed in the Review UI** — it exists at the database level.

### Dedicated Review Queue

Yes — the `review` tab is **its own dedicated page** accessible only to users with the `reviewer` role. A Sheikh or Islamic scholar logs in, sees only the Review tab in the sidebar, and works through the queue without access to any other admin functionality.

---

## 6. 📊 ANALYTICS & REPORTING

### Dashboard KPIs (Live Data)

From [athkari-admin/src/pages/Dashboard.tsx](athkari-admin/src/pages/Dashboard.tsx) via `analyticsService.getDashboardKPIs()`:

| KPI               | Source              | Calculation                                             |
| ----------------- | ------------------- | ------------------------------------------------------- |
| Total Families    | `families` table    | COUNT(\*)                                               |
| Total Kids        | `kids` table        | COUNT(\*)                                               |
| Adhkar Today      | `daily_goals` table | SUM(completed_count) WHERE goal_date = today            |
| Active Challenges | `challenges` table  | COUNT(\*) WHERE status = 'active'                       |
| Active Kids (7d)  | `kids` table        | COUNT(\*) WHERE last_active >= 7 days ago               |
| Wird Done Today   | `wird_logs` table   | COUNT(\*) WHERE is_complete = true AND log_date = today |
| Badges Earned     | `kid_badges` table  | COUNT(\*)                                               |
| Friendships       | `friendships` table | COUNT(\*)                                               |

### Supporting Tables

| Data                 | Source                                                      |
| -------------------- | ----------------------------------------------------------- |
| Recent Families (10) | `families` ordered by `created_at` DESC, joined with `kids` |
| Top Kids (10)        | `kids` ordered by `stars` DESC                              |

### Revenue Analytics

From [athkari-admin/src/pages/Revenue.tsx](athkari-admin/src/pages/Revenue.tsx):

⚠️ **Revenue data is currently hardcoded** — the `MRR_DATA` array contains static data for Oct 2025 through Feb 2026. The page does NOT call the `analytics-aggregate` edge function or any Supabase query.

Displayed metrics (static):

- MRR / ARR with month-over-month change percentages
- Active subscription count with growth
- Monthly churn rate with change
- CSS horizontal bar chart (MRR per month, scaled relative to $20,000)
- Revenue breakdown by plan (pie-like percentages)
- Revenue breakdown by region (6 countries with flag emojis)

### Chart Types

- **KPI Cards** (`KPICard` component): Number with emoji icon and optional change percentage
- **Data Tables** (`DataTable` component): Sortable, paginated tables
- **Horizontal Bar Chart** (CSS-based): Revenue page MRR growth
- ⚠️ No dedicated charting library (Recharts, Chart.js) is used.

### Filters & Time Ranges

- **Dashboard:** No time range filter (shows current state + 7-day active window)
- **Users:** Status filter (all/active/trial/churned) + search + pagination
- **Revenue:** No filters (static data)
- **Audit Log:** Pagination only (20/page, newest first)
- **Referrals:** Pagination only (20/page)
- **Push History:** Pagination only (20/page)

### Export Functionality

⚠️ No export functionality (CSV, PDF, etc.) is currently implemented on any page.

---

## 7. 🔔 NOTIFICATION MANAGEMENT

Implemented in [athkari-admin/src/pages/Push.tsx](athkari-admin/src/pages/Push.tsx) with [athkari-admin/src/services/push.ts](athkari-admin/src/services/push.ts).

### Creating Notification Templates

Admin creates templates with:

- **Icon:** Emoji picker with 40+ notification-themed emojis
- **Name:** Internal label for the template
- **Titles:** `title_en` and `title_ar` (bilingual)
- **Bodies:** `body_en` and `body_ar` (textareas, Arabic field is RTL)
- **Target segment:** Dropdown with 4 options:
  - `everyone` — All device tokens
  - `subscribers` — Active paying families only
  - `inactive` — Kids inactive 3+ days
  - `parents` — Parent device tokens only

### Scheduling Templates

The schedule section uses a custom format string: `"HH:MM|FREQ|TZ1,TZ2,TZ3"`

- **Time:** Local time picker (e.g., "08:00")
- **Frequency:** daily, weekdays (Sun–Thu), fri, sat_sun
- **Timezones:** Multi-select from 9 defined timezones:
  - 🇵🇸 Palestine (Asia/Hebron)
  - 🇸🇦 Saudi Arabia (Asia/Riyadh)
  - 🇦🇪 UAE (Asia/Dubai)
  - 🇶🇦 Qatar (Asia/Qatar)
  - 🇰🇼 Kuwait (Asia/Kuwait)
  - 🇧🇭 Bahrain (Asia/Bahrain)
  - 🇴🇲 Oman (Asia/Muscat)
  - 🇪🇬 Egypt (Africa/Cairo)
  - 🇯🇴 Jordan (Asia/Amman)
- **Presets:** Quick-select All, Gulf, Levant timezone groups

Scheduled templates are evaluated by the **`push-scheduled` edge function** (cron job on the backend) which checks `notification_templates` per timezone and deduplicates via the `notification_template_tz_log` table.

### Manual Send

The "Send" sub-tab allows immediate notification dispatch:

1. Select a template (populates title/body from template)
2. Choose segment
3. Select timezones
4. Click "Send" → `pushService.send()` makes an HTTP POST to the **`push-send` edge function**:
   ```
   POST ${VITE_SUPABASE_URL}/functions/v1/push-send
   Authorization: Bearer ${SERVICE_KEY || ANON_KEY}
   Body: { title_en, title_ar, body_en, body_ar, segment, timezones }
   ```
5. The edge function retrieves matching device tokens, deduplicates, and sends via the Expo Push API in batches of 100.

### Send History & Delivery Stats

The "History" sub-tab shows:

- **Table columns:** Timestamp, segment, status, count sent
- **Pagination:** 20/page from the `notifications` table ordered by `created_at` DESC
- ⚠️ Detailed per-device delivery stats appear stored in the `notifications.stats` JSONB column but are not expanded in the current UI.

---

## 8. 💡 KEY TECHNICAL DECISIONS

### 1. Dual Supabase Client Architecture for Admin Security

The admin dashboard creates **two separate Supabase clients** in [athkari-admin/src/services/supabase.ts](athkari-admin/src/services/supabase.ts):

- `supabaseAuth` (anon key): Handles login via Supabase Auth — ensures admins authenticate through the standard auth flow
- `supabase` (service_role key): All data operations bypass RLS entirely

This separation ensures that authentication is properly validated through Supabase Auth, while data access is unrestricted for admin operations. The service_role client explicitly disables `persistSession`, `autoRefreshToken`, and `detectSessionInUrl` to prevent session-related side effects.

### 2. Two-Layer Admin Verification

Having a valid Supabase Auth account is **not sufficient** to access the dashboard. After `signInWithPassword()`, the app calls `securityService.getAdminByEmail(email)` to check the `admin_users` table. The admin must:

- Exist in `admin_users`
- Have `is_active = true`
- Have a valid `role`

This means revoking admin access is instant — set `is_active = false` in the database, and the admin is locked out on next page load, even with a valid Supabase session.

### 3. Comprehensive Audit Trail with Field-Level Diffs

Every CRUD operation across the entire dashboard calls `securityService.logAudit()` with:

- `adminId` and `adminName` — who did it
- `action` — CREATE, UPDATE, DELETE, SEND
- `entityType` and `entityId` — what was affected
- `oldValue` and `newValue` — JSONB snapshots

The Security page's audit detail modal parses these JSONB objects and renders a **field-by-field diff table** with color-coded rows: green for added fields, red for removed, yellow for changed, gray for unchanged. This provides full traceability of every admin action.

### 4. Tab-Based Navigation Without a Router

Instead of using React Router or TanStack Router, the dashboard uses `useState("tab")` in [athkari-admin/src/App.tsx](athkari-admin/src/App.tsx) with a `PAGE_MAP` object that maps tab names to page components. This is a deliberate decision for an internal tool:

- No URL state to manage or break
- No route guards to implement (RBAC is in `getAllowedTabs()`)
- Simpler mental model — the sidebar is the single source of navigation
- One fewer dependency to maintain

### 5. Original-Value Tracking for Audit Accuracy

Multiple pages (Content, Gamify, Levels, Challenges, Plans, Push, Voice, Wird, Onboarding, Security) maintain both an `editing` state and an `original` state. When the admin starts editing:

```
setEditing(item)      // mutable copy for the form
setOriginal(item)     // frozen snapshot
```

On save, the audit log receives `oldValue: original` and `newValue: editing`, ensuring the diff accurately reflects what changed — even if the admin modified the same field multiple times before saving.

---

## 9. 🔗 CONNECTION TO MOBILE APP

### Shared Supabase Tables

The admin dashboard reads and writes to **every table** that the mobile app uses. The complete list of tables accessed by the admin:

| Table                                | Admin Operations                             | Mobile Impact                                           |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------------------- |
| `categories`                         | CRUD + reorder                               | Kids see updated category list                          |
| `adhkar`                             | CRUD + status transitions                    | Kids see new/updated Azkar content                      |
| `badges`                             | CRUD + reorder                               | Kids see new achievements to unlock                     |
| `levels`                             | CRUD + kid reassignment                      | Kids' level progression is modified                     |
| `challenges` / `challenge_templates` | CRUD                                         | Kids see new challenges to join                         |
| `challenge_participants`             | Read + cascade delete                        | Affects active competition data                         |
| `plans`                              | CRUD + reorder                               | Parents see updated subscription options                |
| `promo_codes`                        | CRUD                                         | Parents can use new discount codes                      |
| `wird_templates`                     | CRUD                                         | Kids get new daily programs                             |
| `families`                           | Read only                                    | —                                                       |
| `kids`                               | Read only (+ level reassign on level delete) | Affected kids' levels change                            |
| `kid_badges`                         | Read only (stats)                            | —                                                       |
| `wird_logs`                          | Read only (impersonation)                    | —                                                       |
| `daily_goals`                        | Read only (KPIs)                             | —                                                       |
| `friendships`                        | Read only (KPIs)                             | —                                                       |
| `voice_profiles`                     | CRUD                                         | Kids hear different voice options                       |
| `voice_files`                        | CRUD + storage upload/delete                 | Kids hear new/updated voice recitations                 |
| `notification_templates`             | CRUD                                         | Scheduled notifications change                          |
| `notifications`                      | Read (history) + create (send)               | Kids/parents receive push notifications                 |
| `onboarding_screens`                 | CRUD + reorder                               | New users see updated onboarding                        |
| `app_config`                         | CRUD (key-value)                             | Feature flags, maintenance, limits change for all users |
| `admin_users`                        | CRUD                                         | Admin access changes                                    |
| `audit_log`                          | Read + write                                 | — (internal)                                            |

### Edge Functions Called from the Dashboard

| Edge Function      | Called From                                                                                                                             | Purpose                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **push-send**      | `pushService.send()` in [Push.tsx](athkari-admin/src/pages/Push.tsx)                                                                    | Manual push notification dispatch to device tokens via Expo Push API   |
| **voice-generate** | `voiceService.generateVoice()` in [Voice.tsx](athkari-admin/src/pages/Voice.tsx) and [Content.tsx](athkari-admin/src/pages/Content.tsx) | ElevenLabs TTS generation → MP3 upload to `voice-files` storage bucket |

### Real-Time Impact of Admin Changes

Because the mobile app uses **Supabase Realtime subscriptions** on key tables, admin changes propagate to mobile users in real time:

| Admin Action                                              | Mobile App Behavior                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Publish an adhkar (change `sharia_status` to `published`) | `useAdhkar` hook detects `postgres_changes` → new dhikr appears in categories                        |
| Toggle `maintenance_mode` to `true` in Settings           | `useAppConfig` hook detects change → `AppGate` component renders maintenance overlay **immediately** |
| Set `force_update` to `true` + bump `min_app_version`     | `AppGate` checks version → renders force-update screen with App Store link                           |
| Create a new community challenge                          | `useChallenges` hook detects change → challenge appears in kids' challenges tab                      |
| Toggle a feature flag off (e.g., `friends: false`)        | `useFeatureFlags` hook reads updated config → friend features disappear from UI                      |
| Update a plan's price or features                         | `usePlans` hook detects change → updated plan card shows for parents                                 |
| Update `max_friends_per_kid`                              | Mobile `friend-manage` edge function reads new limit from `app_config`                               |
| Change category display order                             | `useCategories` hook re-fetches → categories reorder on home screen                                  |

### How AppGate Is Controlled

The `AppGate` component in the mobile app reads two values from `app_config`:

1. **Maintenance Mode:** Admin toggles `maintenance_mode` in Settings → sets `maintenance_msg` → mobile `AppGate` renders a blocking overlay with the custom message
2. **Force Update:** Admin toggles `force_update` + sets `min_app_version` → mobile `AppGate` compares semantic versions → renders "Please update" screen with App Store links

These are **instant** — the mobile app's `useAppConfig` hook has a Supabase Realtime subscription on the `app_config` table.

---

## 10. ✅ WHY THIS DASHBOARD IS WELL-BUILT

### Paragraph 1: Security Model, RBAC, and Audit Trail

"The Athkari admin dashboard implements a layered security model that goes beyond basic authentication. First, admins must authenticate through Supabase Auth with valid credentials. Second, they must exist in the `admin_users` table with `is_active = true` — meaning access can be revoked instantly without touching Supabase Auth. Third, the six-role RBAC system (`super_admin`, `content_mgr`, `reviewer`, `support`, `analyst`, `viewer`) restricts each role to only the tabs they need: a content manager cannot access billing, a reviewer sees only the Sharia review queue, and a viewer gets read-only dashboard access. Every single CRUD operation across all 16 pages is logged to the `audit_log` table with the admin's identity, the action performed, the entity affected, and full JSONB snapshots of the old and new values. The Security page's audit detail modal renders field-by-field diffs with color-coded highlighting, giving complete traceability. The dual Supabase client architecture — anon key for auth, service_role key for data — ensures authentication flows are properly validated while admin data operations can bypass RLS as intended."

### Paragraph 2: Full Operational Control Without Touching Code

"This dashboard gives the operations team complete control over the mobile app experience without any code changes or deployments. Content managers can create, edit, and publish Azkar through a 5-stage Sharia review pipeline with dedicated reviewer access. The gamification team can adjust badge criteria, level thresholds, star rewards, and celebration animations in real time — changes propagate to the mobile app via Supabase Realtime subscriptions. The marketing team can create and schedule push notifications targeting specific segments and timezones across 9 Middle Eastern regions, with full send history visibility. The business team can modify subscription plans, manage promo codes, and monitor user growth through the dashboard KPIs. Most critically, the Settings page gives administrators an instant kill switch: toggling maintenance mode or force-update immediately affects every mobile app user through the `AppGate` component — no app store submission required, no deployment needed. Feature flags can enable or disable entire features (challenges, friends, wird, leaderboard, referrals, 1v1) with a single toggle. This level of operational control means the team can respond to issues, launch campaigns, and evolve the product without developer intervention."

---

_End of Admin Dashboard Technical Briefing_

_File count: 55+ source files | Pages: 16 | Components: 7 shared | Hooks: 9 | Services: 16 | Context: 1 | Tables accessed: 20+ | Edge functions invoked: 2 | Admin roles: 6_
