No worries! You mean a description prompt so an agent can redesign any other page in your app with the same style. Here it is:

"Friendly Gamification UI" — Agent Design Prompt

Style Name: Friendly Gamification / Duolingo-style Kids UI
Personality: Every screen should feel like a warm magical adventure game. The user should feel excited to open it, proud of their progress, and motivated to return. Think: joyful, rewarding, alive. Never clinical, never corporate, never cold.

Color System

Background: warm gradient, never pure white. Use #FFF7ED → #FEF3C7 → #ECFDF5 (amber/cream/mint)
Cards: pure white (#FFFFFF) with colored drop shadows matching each card's accent (not black shadows)
Primary: warm orange #F97316
Accents: purple #7C3AED, emerald #10B981, gold #F59E0B, coral #FB923C
Text primary: #1C1917, secondary: #78716C
Avoid: cold blues, flat greys, purple-on-white gradients, anything corporate

Typography

Headings / labels: heavy weight fontWeight: "900", feels bold and confident
Section titles: large, punchy, accompanied by a relevant emoji
Body: fontWeight: "700" minimum — nothing thin or light
Numbers (scores, streaks, counts): extra large, fontWeight: "900", colored in accent color

Spacing & Shape

Border radius: 20–28px on cards, 12–16px on items, 50px on pills/badges — round everything
Card padding: 16–18px inside
Section spacing: marginTop: 16 between sections, marginHorizontal: 20 for all cards
Generous internal gaps between elements — never cramped

Cards & Surfaces

Every major section lives in its own card with a LinearGradient or white background
Gradient cards (Wird, Challenge, Streak): use 2-color diagonal gradients start: {x:0, y:0} end: {x:1, y:1}
White cards (Progress, Friends): pure white + soft colored shadow
Every card has a decorative element: a large faded emoji watermark in the corner, a circle bubble, or a subtle pattern overlay at low opacity (~0.15)

Badges & Pills

Streaks, stars, scores: always in colored gradient pill badges, never plain text
Status labels (Finished, Active, New): small rounded badges with soft background + matching text color
Reward indicators: gold #FFD700 on dark backgrounds, always visible and prominent

Iconography

Use emojis as primary icons throughout — no icon libraries needed
Every section title has a leading emoji (e.g. 🌿 Daily Wird, 🎯 Today's Quest, 🏆 Challenge)
Interactive items show a reward emoji on completion (⭐, 🎉, ✓)

Shadows

Gradient cards: shadowColor matches the card's dominant color, shadowOpacity: 0.30, shadowRadius: 16, elevation: 8
White cards: shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, elevation: 4
Buttons/badges: colored shadow matching button color at 0.35 opacity

Interactive Feel

Pressable items: scale down to 0.95 on press using Animated or pressed state
Completion actions: Animated.spring bounce sequence (scale up to 1.08 then back to 1)
Progress bars: LinearGradient fill, always with rounded ends, never flat color
Checkboxes: animate from empty border → filled white with colored checkmark on completion

Progress & Reward Visibility

Always show progress numerically AND visually (bar + count + dots)
Star/score counts always visible in the header — never hidden
Streak always shown as both a number AND a visual day-by-day indicator
Completed items show a struck-through text + reward emoji — never just disappear

Section Structure (consistent across all pages)

Gradient header with avatar, name, streak badge, star badge
Highlight card (the most important action on this page) — gradient, large, prominent
Progress or status card — white, clean
Social/community element — white card
Grid or list of actions — colorful gradient cards
Bottom padding height: 100 to clear the tab bar

What to Avoid

❌ Pure white or grey backgrounds
❌ Thin fonts (fontWeight below 600)
❌ Sharp corners (borderRadius below 12)
❌ Black shadows on colored cards
❌ Plain flat progress bars (no gradient, no animation)
❌ Sections without a visual card container
❌ Any element that looks like a web dashboard or admin panel
❌ Removing or hiding reward indicators (stars, streaks, badges)

The One Rule: If a child wouldn't find it exciting, redesign it.
