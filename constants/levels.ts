// ── Level System Configuration ──
// Each level requires cumulative stars. Level is computed client-side.

export interface LevelDef {
  level: number;
  starsRequired: number;
  emoji: string;
  titleEn: string;
  titleAr: string;
  gradient: [string, string];
}

export const LEVELS: LevelDef[] = [
  {
    level: 1,
    starsRequired: 0,
    emoji: "🌱",
    titleEn: "Seedling",
    titleAr: "بذرة",
    gradient: ["#6EE7B7", "#34D399"],
  },
  {
    level: 2,
    starsRequired: 50,
    emoji: "🌿",
    titleEn: "Sprout",
    titleAr: "نبتة",
    gradient: ["#34D399", "#10B981"],
  },
  {
    level: 3,
    starsRequired: 150,
    emoji: "🌸",
    titleEn: "Blossom",
    titleAr: "زهرة",
    gradient: ["#F9A8D4", "#EC4899"],
  },
  {
    level: 4,
    starsRequired: 300,
    emoji: "⭐",
    titleEn: "Star",
    titleAr: "نجمة",
    gradient: ["#FCD34D", "#F59E0B"],
  },
  {
    level: 5,
    starsRequired: 500,
    emoji: "🌟",
    titleEn: "Shining",
    titleAr: "متألق",
    gradient: ["#F59E0B", "#D97706"],
  },
  {
    level: 6,
    starsRequired: 750,
    emoji: "💎",
    titleEn: "Diamond",
    titleAr: "ماسة",
    gradient: ["#60A5FA", "#3B82F6"],
  },
  {
    level: 7,
    starsRequired: 1100,
    emoji: "🔥",
    titleEn: "Blazing",
    titleAr: "متقد",
    gradient: ["#FB923C", "#F97316"],
  },
  {
    level: 8,
    starsRequired: 1500,
    emoji: "🏆",
    titleEn: "Champion",
    titleAr: "بطل",
    gradient: ["#A78BFA", "#7C3AED"],
  },
  {
    level: 9,
    starsRequired: 2000,
    emoji: "👑",
    titleEn: "Royal",
    titleAr: "ملكي",
    gradient: ["#7C3AED", "#5B21B6"],
  },
  {
    level: 10,
    starsRequired: 3000,
    emoji: "🦁",
    titleEn: "Legend",
    titleAr: "أسطورة",
    gradient: ["#FFD700", "#F59E0B"],
  },
];

/** Get level info from total stars */
export function getLevelFromStars(stars: number): LevelDef {
  let result = LEVELS[0];
  for (const lvl of LEVELS) {
    if (stars >= lvl.starsRequired) result = lvl;
    else break;
  }
  return result;
}

/** Get next level (or null if max) */
export function getNextLevel(currentLevel: number): LevelDef | null {
  const idx = LEVELS.findIndex((l) => l.level === currentLevel);
  if (idx < 0 || idx >= LEVELS.length - 1) return null;
  return LEVELS[idx + 1];
}

/** Stars needed for next level (0 if maxed) */
export function starsToNextLevel(stars: number): number {
  const next = getNextLevel(getLevelFromStars(stars).level);
  if (!next) return 0;
  return next.starsRequired - stars;
}

/** Progress % toward next level (0-100) */
export function levelProgress(stars: number): number {
  const current = getLevelFromStars(stars);
  const next = getNextLevel(current.level);
  if (!next) return 100;
  const range = next.starsRequired - current.starsRequired;
  const progress = stars - current.starsRequired;
  return Math.min(Math.round((progress / range) * 100), 100);
}
