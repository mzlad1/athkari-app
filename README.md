# Athkari Mobile App

A feature-rich Islamic adhkar (remembrance) app designed for children, with full parental controls, gamification, social features, and real-time synchronization. Built with React Native (Expo), TypeScript, and Supabase.

---

## Tech Stack

| Layer              | Technology                                |
| ------------------ | ----------------------------------------- |
| Framework          | React Native (Expo SDK 52)                |
| Language           | TypeScript                                |
| Navigation         | Expo Router (file-based routing)          |
| Backend            | Supabase (PostgreSQL + Auth + Realtime)   |
| Data Fetching      | SWR (stale-while-revalidate)              |
| Payments           | RevenueCat (in-app subscriptions)         |
| Push Notifications | Expo Notifications                        |
| Storage            | AsyncStorage (offline persistence)        |
| Animations         | React Native Animated API (spring/timing) |

---

## App Architecture

The app serves two distinct user roles with separate navigation stacks:

- **Kids** — Tab-based interface with adhkar, challenges, badges, and social features
- **Parents** — Dashboard interface for monitoring kids, managing friends, and controlling settings

Routing is handled by Expo Router with file-based navigation. Auth state determines which stack the user sees. Kids can log in via parent-generated QR codes, OTPs, or PINs. Parents authenticate with email and password.

---

## Onboarding & Authentication

### Onboarding Carousel — `index`

A 3-slide introduction shown on first launch:

1. **Welcome to Adhkar** — Introduces the app's core purpose with a prayer hands emoji and amber theme
2. **Challenge Friends** — Highlights the social competition features with a trophy emoji and violet theme
3. **Maintain Streaks** — Shows the streak and consistency system with a fire emoji and green theme

Each slide features floating emoji animations, gradient backgrounds, and smooth page transitions. A language toggle (Arabic/English) is accessible from the top-right corner. Users can skip directly to authentication or navigate through all slides.

---

### Role Selection — `(auth)/role-select`

An animated card selection screen where users choose between:

- **Parent** — Warm dawn gradient with star patterns. Leads to parent registration.
- **Kid** — Night sky gradient with moon and stars. Leads to kid login.

Cards feature floating emoji animations and particle effects. Language toggle is available on this screen.

---

### Parent Registration — `(auth)/parent-register`

Dual-mode form supporting both registration and sign-in:

- **Register mode:** Email + password (minimum 6 characters) to create a new parent account
- **Sign-in mode:** Email + password for returning parents

Styled with warm amber and cream gradients with decorative star patterns and floating geometric elements. All form inputs have animated focus states.

---

### Kid Login — `(auth)/kid-login`

Three authentication methods for kids:

1. **OTP (One-Time Password):** Parent generates a code, kid enters it. Validated in real-time via Supabase listeners.
2. **PIN Code:** 4-digit PIN set by parent during kid setup. Custom dot display with animated input.
3. **QR Code Scan:** Parent displays a QR code from their dashboard, kid scans it to log in instantly.

Night sky gradient background with gold and coral accents. Each method has its own visual input component.

---

### Kid Setup — `(auth)/kid-setup`

New kid profile creation with:

- **Avatar Selection:** Grid of 12 emoji avatars to choose from
- **Name Input:** Kid's display name
- **Age Group Selection:** 4–6, 7–9, or 10–12 years

A live preview card updates in real-time as the kid picks an avatar and enters their name, with smooth scale animations on changes.

---

### Add Kid — `(auth)/add-kid`

Parents add additional children to their family account:

- Name input with validation
- Avatar selection grid (12 emoji options)
- Age group picker
- PIN code setup for the new kid's login
- Live preview card showing the configured profile

---

### Plan Selection — `(auth)/plans`

Subscription tier selection during onboarding:

- **Multiple tiers:** Free, Pro, Family (configurable from admin)
- **Billing toggle:** Annual vs Monthly pricing
- **Plan badges:** "Popular" and "Best Value" highlights
- **Feature comparison:** Visual checklist of what each plan includes
- **RevenueCat integration:** In-app purchase flow for paid plans

---

### Referral — `(auth)/referral`

Optional screen for new kids to enter a referral code:

- Input field with code validation against the database
- Success animation with bouncing stars on valid code
- Star bonus awarded to both referrer and new kid
- Can be skipped

---

## Kid Experience

### Home — `(tabs)/home`

The central daily hub for kids. This is the most feature-dense screen in the app.

**Header Section:**

- Kid avatar with animated spinning gradient ring
- Personalized greeting with kid's name
- Star count display with bounce animation
- Streak badge showing current streak days
- Notification bell with unread count badge
- Language toggle button

**Wird Section (Daily Prayers):**

- Grid layout of today's assigned adhkar items
- Each item shows Arabic text, repetition target, and completion checkmark
- Tap an item to navigate to its dhikr screen
- Progress tracking persisted across app restarts
- Celebration overlay triggers when all wird items are completed

**Seasonal Wird:**

- Special seasonal adhkar section (appears when enabled by parent/admin)
- Custom card styling with unique gradients and icons
- Separate completion tracking from regular wird

**Daily Goal Progress:**

- Visual progress bar showing today's adhkar count vs daily target
- Animated fill with gradient coloring
- Auto-increments as kid completes adhkar

**Categories Grid:**

- 3-column grid of all adhkar categories (Morning, Evening, Sleep, Food, Mosque, etc.)
- Each card shows category emoji, Arabic/English title, gradient background
- Completion indicator for categories finished today
- Tap navigates to the full dhikr experience

**Challenges Preview:**

- Active community challenges with progress bars
- Completed challenge results
- Tap to navigate to full challenge screen

**Week Streak Indicator:**

- Day-by-day completion tracker (Sunday through Saturday)
- Filled circles for completed days, empty for missed
- Visual streak chain

**Level Road:**

- Visual progression path showing current level and next milestones
- Level emoji and star requirement displayed
- Animated progression markers

---

### Dhikr Screen — `dhikr/[categoryId]`

Full-screen immersive adhkar recitation interface (opens as modal).

**Main Display:**

- Large circular area showing current dhikr text in Arabic
- English meaning displayed below
- Visual bead circle representing repetition progress (up to 33 beads)

**Tap Interaction:**

- Tap the circle to increment the counter
- Haptic feedback on each tap
- Spring scale animation (0.91) on press
- Star bounce animation (1.4x scale) when earning points

**Motivational Messages:**

- Character speech bubbles appear with encouraging phrases
- Messages include: "Alhamdulillah!", "Masha'Allah!", "Keep going!" etc.
- Fade in/out animations

**Progress Tracking:**

- Per-dhikr completion counter
- Auto-advance to next dhikr when current reaches its repetition target
- Points earned display per completed dhikr
- Overall category completion percentage

**Completion Celebration:**

- Full-screen overlay with celebration animation when all adhkar in the category are done
- Stars earned summary
- Category marked as completed for the day

**Persistence:**

- Progress saved to AsyncStorage so kids can resume mid-category if they close the app
- Resets daily

**RTL Support:** Full right-to-left layout for Arabic text with proper alignment.

---

### Challenges — `(tabs)/challenges`

Social competition hub with four sub-tabs:

**Leaderboard Tab:**

- Top-performing kids ranked by engagement
- Avatar, name, stars, and streak display
- Current kid highlighted in the rankings

**Weekly Challenge Tab:**

- Active community challenge with cumulative group goal
- Progress bar showing total contributions
- Individual contribution tracking
- Days/hours remaining countdown
- Reward preview (stars to earn)

**Friends Tab:**

- List of all current friends with their stats (stars, streak, today's count)
- Tap a friend to view profile or start a 1v1 challenge
- Reaction system: send Masha'Allah, Keep Going, Love, or Dua reactions to friends
- Chat history between friends
- Incoming/outgoing challenge status
- Social badges: New Friend, Social, Motivator

**Invite Tab:**

- Display own unique friend code
- Share code via WhatsApp or native share sheet
- Input field to enter another kid's friend code
- Send friend request (requires parent approval)

**Real-Time Updates:** Supabase realtime subscriptions keep challenge progress, friend requests, and reactions synced live.

---

### Badges — `(tabs)/badges`

Achievement showcase and progress tracker.

**Stats Cards:**

- Total adhkar completed
- Current streak (days)
- Total stars earned
- Categories completed

**Earned Badges:**

- Visual grid of all badges the kid has unlocked
- Each badge shows its icon, name, and date earned
- Spinning medal animation in the header

**Locked Badges:**

- Remaining badges shown with lock overlay
- Progress bar toward each badge's threshold
- Criteria description (e.g., "Complete 100 adhkar" — progress: 67/100)
- Color-coded progress indicators

**Pull-to-refresh** to sync latest badge evaluations.

---

### Challenge Play — `challenge/[challengeId]`

Live challenge competition screen (opens as modal).

**Community Challenges:**

- Large animated circular progress showing goal completion percentage
- Participant list with individual contribution counts
- Days and hours remaining countdown
- Tap-to-contribute: kids tap to add their adhkar count to the challenge
- Real-time leaderboard updates as participants contribute
- Completion celebration overlay when the challenge goal is met

**1v1 Challenges:**

- Head-to-head layout showing both participants
- Individual progress bars
- Live score comparison
- Challenge status: pending, active, completed, expired

**Real-Time Sync:** Supabase Postgres changes subscription provides live updates. Additional 4-second polling as a fallback.

---

### Bedtime Mode — `bedtime`

Calm, sleep-focused adhkar experience (opens as modal).

- Slow, gentle animations with extended durations
- Large Arabic text display optimized for dim lighting
- Generous repetition counter (larger tap targets than normal mode)
- Soft midnight color scheme with muted accents
- Auto-advance to next dhikr on completion
- Light haptic feedback (softer than regular mode)
- "Good Night" celebration screen when all bedtime adhkar are completed
- Designed for a peaceful wind-down routine

---

### Add Friend — `add-friend`

Friend connection modal.

- Display own unique friend code with copy button
- Share code via WhatsApp or device share sheet
- Input field to enter another kid's code
- Validation against the database
- Send friend request on valid code
- Info card explaining the friendship flow (request → parent approval → connected)
- Error handling for invalid or self-referencing codes

---

### Notifications — `notifications`

In-app notification center (opens as modal).

**Notification Types:**

- Friend request received/accepted
- Reaction from a friend
- Challenge invitation
- Challenge completed
- Badge earned
- Streak milestone
- System announcements

Each notification shows type-specific icon and color, message text, and relative timestamp ("2 minutes ago", "yesterday").

**Features:**

- Pull-to-refresh
- Mark all as read button
- Real-time updates with haptic feedback on new notification
- Unread count badge synced with home screen bell icon

---

### Settings — `settings`

App preferences modal.

- **Notifications toggle:** Enable/disable push notifications
- **Sound effects toggle:** Enable/disable tap and celebration sounds
- **Haptics toggle:** Enable/disable vibration feedback
- **Account info:** Display name, email, current subscription plan
- **Upgrade plan:** Link to plan selection
- **Restore purchases:** Sync RevenueCat subscription status
- **Logout:** Confirmation dialog before signing out

---

## Parent Dashboard

### Kids Management — `(parent-dashboard)/kids`

Central hub for managing all children in the family.

**Per-Kid Card:**

- Avatar, name, and age group display
- Streak and star count badges
- Quick stats: today's adhkar, streak days, total stars, wird completion percentage

**Kid Actions:**

- **Edit profile:** Change name, avatar, age group
- **Assign wird template:** Pick from available templates in the database
- **Seasonal wird toggle:** Enable/disable seasonal adhkar for this kid
- **Custom seasonal items:** Add custom adhkar text (Arabic + English) specific to this kid
- **QR login code:** Generate a one-time QR code for kid login (expires in 60 seconds with visible countdown timer)
- **Remove kid:** Delete with confirmation dialog

**Add New Kid:** Button to navigate to the add-kid flow.

Animated gradient backgrounds on each kid's card. QR codes are displayed inline with a live expiration countdown.

---

### Activity Monitor — `(parent-dashboard)/monitor`

Weekly performance tracking and category-level analytics.

**Kid Selector:** Dropdown to switch between children.

**6-Stat Grid:**

- Today's adhkar count
- Current streak days
- Total stars earned
- Badges unlocked
- Lifetime adhkar total
- Friends count

**Weekly Bar Chart:**

- Last 7 days of daily adhkar counts
- Visual bar representation with day labels (Sun–Sat)
- Highlights today's bar

**Category Progress:**

- Per-category adhkar completion for the current week
- Shows which categories the kid has been engaging with most

**Wird Status Card:**

- Daily wird completion percentage
- Visual progress indicator

**Statistics Summary:**

- Weekly total adhkar
- Average adhkar per active day
- Best performing day of the week
- Number of active days (days with at least one adhkar)

---

### Friends Management — `(parent-dashboard)/friends`

Parental oversight of kid's social connections.

**Pending Requests:**

- List of incoming friend requests awaiting parent approval
- Approve or reject buttons per request
- Requester's name and avatar displayed

**Current Friends:**

- All accepted friends with their stats (stars, streak, today's count)
- Remove friend option

**Add Friend:**

- Input field to send a friend request on behalf of the kid
- Code validation and error feedback

**Chat History:**

- View reaction/message exchanges between friends

---

### Subscription Plans — `(parent-dashboard)/plans`

Subscription management for the family.

- Current plan display with feature list
- Available upgrade/downgrade options
- Billing cycle information (monthly vs annual)
- Feature comparison across tiers
- Restore purchases button (syncs with RevenueCat)

---

### Parent Settings — `(parent-dashboard)/settings`

Parental controls and account preferences.

**Kid Permissions:**

- Allow/disallow kid from adding friends
- Allow/disallow kid chat and reactions
- Allow/disallow kid from accepting challenge invitations

**Notifications:** Push notification preferences.

**Account:** Logout with confirmation.

---

## Components

### UI Components

| Component        | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| **Avatar**       | Profile picture display with gradient ring backgrounds            |
| **Button**       | Reusable button with gradient and solid style variants            |
| **Card**         | Rounded container with shadow and padding                         |
| **ConfirmModal** | Confirmation dialog for destructive actions (delete, logout)      |
| **Loading**      | Spinner with optional message text                                |
| **ProgressBar**  | Animated progress bar with gradient fill                          |
| **Skeleton**     | Placeholder shimmer components (HomeSkeleton, WirdSkeleton, etc.) |
| **SubTabBar**    | Sub-section tab navigator for pages with multiple views           |
| **Toast**        | Toast notification system (success, error, info)                  |
| **PinInput**     | PIN code input with animated dot display                          |
| **AuthHeader**   | Auth page header with gradient and floating emoji                 |

### Dhikr Components

| Component                 | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| **DhikrCard**             | Individual adhkar display card with Arabic text and meaning |
| **DhikrProgress**         | Progress indicator for dhikr repetition completion          |
| **CompletionCelebration** | Full-screen overlay shown when a category is completed      |

### Gamification Components

| Component              | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| **CelebrationOverlay** | Full-screen celebration with confetti and particle effects |
| **LevelRoad**          | Visual level progression path with milestones              |
| **LevelUpCelebration** | Level-up announcement with animation                       |

### Core Components

| Component        | Description                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **AppGate**      | Wraps the app to show maintenance mode or force-update screens when triggered by remote config |
| **SplashScreen** | Custom 3-stage loading animation shown during app initialization                               |

---

## Hooks

| Hook                       | Purpose                                                                    |
| -------------------------- | -------------------------------------------------------------------------- |
| **useAdhkar(categoryId)**  | Fetches adhkar for a specific category with real-time subscription         |
| **useAppConfig()**         | Retrieves remote app config (maintenance mode, min version, feature flags) |
| **useBadges(kidId)**       | Gets badge progress and earned badges for a kid                            |
| **useCategories()**        | Fetches all adhkar categories with SWR caching                             |
| **useChallenges()**        | Gets active and completed challenges with real-time updates                |
| **useDailyGoal(kidId)**    | Today's adhkar goal target and current progress                            |
| **useFeatureFlags()**      | Checks which features are enabled/disabled                                 |
| **useFriends(kidId)**      | Lists a kid's friends and pending requests                                 |
| **useKidProfile(kidId)**   | Fetches kid profile details (name, avatar, age, etc.)                      |
| **useKidStats(kidId)**     | Aggregated kid statistics (stars, streak, badges, totals)                  |
| **useLevel(kidId, stars)** | Computes current level and triggers level-up celebration                   |
| **usePlans()**             | Fetches available subscription plans                                       |
| **usePushNotifications()** | Registers device token and sets up push notification listeners             |
| **useReactions()**         | Handles sending and receiving friend reactions                             |
| **useStreak()**            | Tracks streak status and fires milestone celebrations                      |
| **useToast()**             | Provides toast notification methods (show, dismiss)                        |
| **useWird(kidId)**         | Fetches daily wird items, tracks completion, and handles seasonal wird     |

---

## Services

| Service                  | Key Functions                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **auth**                 | `registerParent()`, `loginParent()`, `addKid()`, `generateQRToken()`, `verifyPin()`                         |
| **activity**             | `logDhikrComplete()`, `completeWird()`, `completeWirdItem()`, `completeSeasonalWirdItem()`                  |
| **badges**               | `evaluateBadges()`, `getAllBadgesWithProgress()`                                                            |
| **challenges**           | `getChallenges()`, `getLeaderboard()`, `joinChallenge()`, `create1v1FromTemplate()`, `submitContribution()` |
| **completed-categories** | `markCompleted()`, `getCompleted()`                                                                         |
| **daily-goals**          | `getTodayGoal()`, `incrementProgress()`, `updateGoalTarget()`                                               |
| **friends**              | `getFriends()`, `sendRequest()`, `approveRequest()`, `rejectRequest()`, `removeFriend()`                    |
| **kid-progress**         | `getStats()`, `updateLastActive()`                                                                          |
| **levels**               | `fetchLevels()`, `markLevelCelebrated()`                                                                    |
| **notifications**        | `insertInAppNotification()`, `getKidNotifications()`, `markAllRead()`, `getUnreadCount()`                   |
| **plans**                | `getPlans()`, `selectPlan()`                                                                                |
| **referrals**            | `verifyKidCode()`, `applyKidReferral()`                                                                     |
| **streak**               | `checkStreak()`, `getStreak()`                                                                              |
| **subscriptions**        | `restore()` via RevenueCat                                                                                  |
| **supabase**             | Supabase client initialization with AsyncStorage for persistent auth                                        |

---

## Edge Functions (Backend)

The app communicates with Supabase Edge Functions for server-side logic:

| Function                 | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| **auth-register**        | Parent registration with family creation      |
| **auth-login**           | Authentication and session management         |
| **kid-otp**              | Generate and validate kid OTP codes           |
| **kid-notify**           | Send notifications to kids                    |
| **kid-progress**         | Aggregate and return kid statistics           |
| **badge-evaluate**       | Server-side badge criteria evaluation         |
| **streak-check**         | Validate and update streak status             |
| **daily-goal**           | Daily goal management                         |
| **wird-assign**          | Assign wird templates to kids                 |
| **friend-manage**        | Friend request handling with parent approval  |
| **push-send**            | Dispatch push notifications via Expo          |
| **push-scheduled**       | Cron-based scheduled notification delivery    |
| **voice-generate**       | AI voice generation for adhkar recitation     |
| **referral-apply**       | Process referral codes and award bonuses      |
| **sharia-transition**    | Content review status workflow                |
| **subscription-webhook** | RevenueCat webhook handler                    |
| **verify-parent-pin**    | Parent PIN verification for sensitive actions |
| **activity-log**         | Activity logging and aggregation              |
| **analytics-aggregate**  | Analytics data aggregation                    |

---

## Design System

### Color Themes

**Kids Dark Theme:**
| Color | Value | Usage |
|-------|-------|-------|
| Deep Navy | `#06091E` | Primary background |
| Gold | `#FFD60A` | Stars, primary accents |
| Coral | `#FF6B9D` | Highlights, alerts |
| Mint | `#00F5A0` | Success states, streaks |

**Parent Warm Theme:**
| Color | Value | Usage |
|-------|-------|-------|
| Amber | `#D97706` | Primary accent |
| Cream | `#FFFBF5` | Backgrounds |
| Teal | `#0D9488` | Secondary accent |
| Violet | `#7C3AED` | Tertiary accent |

**Category Gradients:**

- Morning adhkar — Amber to gold
- Evening adhkar — Purple to indigo
- Sleep adhkar — Navy to deep blue
- Food adhkar — Green to emerald
- Mosque adhkar — Cyan to teal

### Typography

- **Headings:** fontWeight 900 (bold and confident)
- **Body text:** fontWeight 700+ (no thin or light text)
- **Arabic text:** Amiri font for proper Arabic rendering

### Animation System

- **Spring animations:** tension 180–300, friction 10–14 for natural feel
- **Stagger sequences:** List items animate in with cascading delays
- **Pulse/shimmer loops:** Used for loading states and attention-drawing elements
- **Scale/translate transforms:** All using `useNativeDriver: true` for 60fps performance

### Spacing & Layout

- Card padding: 16–18px
- Section margins: 16px
- Horizontal page margins: 20px
- Border radius: 20–28px (cards), 12–16px (items), 50px (pills and badges)

---

## Bilingual Support

The entire app is fully bilingual with Arabic and English:

- All UI text is translated via the `translations` constant
- Language context (`LangContext`) provides current language and toggle function
- Arabic text renders with RTL layout direction
- Language can be switched from multiple screens (onboarding, home, role selection)
- Content (adhkar, categories, badges, challenges) stores both `name_ar` and `name_en` fields

---

## Offline & Persistence

- **Dhikr progress** saved to AsyncStorage — kids can close and resume mid-category
- **Daily resets** — progress resets at the start of each new day
- **Auth session** persisted via Supabase AsyncStorage adapter
- **SWR caching** provides stale data while revalidating in the background

---

## Real-Time Features

Powered by Supabase Realtime subscriptions:

- **Challenge progress** — live updates as participants contribute
- **Friend requests** — instant notification when requests arrive
- **Reactions** — real-time delivery of friend reactions
- **Notifications** — in-app notification feed auto-updates
- **OTP validation** — kid login OTP verified in real-time without polling

---

## Celebration Types

Multiple celebration animations used across badges, levels, challenges, and wird completion:

1. **Confetti** — Colorful confetti burst
2. **Stars Rain** — Falling golden stars
3. **Fireworks** — Animated firework explosions
4. **Emoji Burst** — Themed emoji particles
5. **Balloons** — Rising balloon animation
6. **Sparkle** — Glitter and sparkle effects
7. **Golden Glow** — Warm golden radiance
8. **None** — No animation (silent completion)
