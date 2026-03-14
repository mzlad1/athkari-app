import { useState, useEffect, useCallback } from "react";
import { streakService } from "@/services/streak";
import { useAuth } from "@/contexts/AuthContext";

interface StreakState {
  streak: number;
  isNewMilestone: boolean;
  milestoneType: "3day" | "7day" | "14day" | "30day" | null;
  loading: boolean;
  checkStreak: () => Promise<void>;
  dismissMilestone: () => void;
}

const MILESTONES = [3, 7, 14, 30] as const;

export function useStreak(): StreakState {
  const { activeKid } = useAuth();
  const [streak, setStreak] = useState(0);
  const [isNewMilestone, setIsNewMilestone] = useState(false);
  const [milestoneType, setMilestoneType] =
    useState<StreakState["milestoneType"]>(null);
  const [loading, setLoading] = useState(false);

  const checkStreak = useCallback(async () => {
    if (!activeKid?.id) return;
    setLoading(true);
    try {
      const result = await streakService.checkStreak(activeKid.id);
      const newStreak = result?.streak ?? activeKid.streak ?? 0;

      // Check if we just crossed a milestone (compare with state before update)
      setStreak((oldStreak) => {
        for (const m of MILESTONES) {
          if (newStreak >= m && oldStreak < m) {
            setIsNewMilestone(true);
            setMilestoneType(`${m}day` as StreakState["milestoneType"]);
            break;
          }
        }
        return newStreak;
      });
    } catch {
      // Fallback: read fresh from DB
      try {
        const fresh = await streakService.getStreak(activeKid.id);
        if (fresh) setStreak(fresh.streak || 0);
      } catch {
        setStreak(activeKid.streak || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [activeKid?.id]);

  const dismissMilestone = () => {
    setIsNewMilestone(false);
    setMilestoneType(null);
  };

  useEffect(() => {
    if (activeKid?.id) {
      setStreak(activeKid.streak || 0);
      checkStreak();
    }
  }, [activeKid?.id]);

  return {
    streak,
    isNewMilestone,
    milestoneType,
    loading,
    checkStreak,
    dismissMilestone,
  };
}

/** Get celebration message for a streak milestone */
export function getStreakMessage(
  milestone: StreakState["milestoneType"],
  isRTL: boolean,
): { title: string; subtitle: string; emoji: string } {
  switch (milestone) {
    case "3day":
      return {
        emoji: "✨",
        title: isRTL ? "٣ أيام متتالية!" : "3 Day Streak!",
        subtitle: isRTL
          ? "ما شاء الله! أنت ملتزم"
          : "Masha'Allah! You're committed",
      };
    case "7day":
      return {
        emoji: "🔥",
        title: isRTL ? "أسبوع كامل!" : "1 Week Streak!",
        subtitle: isRTL
          ? "رائع! استمر هكذا يا بطل"
          : "Amazing! Keep it going, champ",
      };
    case "14day":
      return {
        emoji: "⚡",
        title: isRTL ? "أسبوعان!" : "2 Week Streak!",
        subtitle: isRTL ? "أنت نجم الأذكار!" : "You're an adhkar superstar!",
      };
    case "30day":
      return {
        emoji: "🏆",
        title: isRTL ? "شهر كامل!" : "1 Month Streak!",
        subtitle: isRTL
          ? "أسطوري! أنت قدوة للجميع"
          : "Legendary! You're an inspiration",
      };
    default:
      return {
        emoji: "🌟",
        title: isRTL ? "أحسنت!" : "Well done!",
        subtitle: isRTL ? "استمر!" : "Keep going!",
      };
  }
}
