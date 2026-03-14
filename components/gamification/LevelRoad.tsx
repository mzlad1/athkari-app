import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useRef, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { LEVELS, getNextLevel, type LevelDef } from "@/constants/levels";

const { width: SW } = Dimensions.get("window");
const NODE_SIZE = 64;
const CONNECTOR_HEIGHT = 56;

interface Props {
  visible: boolean;
  onClose: () => void;
  currentLevel: number;
  stars: number;
  progress: number; // 0-100 toward next level
  isRTL: boolean;
}

export function LevelRoad({
  visible,
  onClose,
  currentLevel,
  stars,
  progress,
  isRTL,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const nextLevelDef = getNextLevel(currentLevel);
  const starsToNext = nextLevelDef ? nextLevelDef.starsRequired - stars : 0;

  // Auto-scroll to current level on open
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        const idx = LEVELS.findIndex((l) => l.level === currentLevel);
        const reversedIdx = LEVELS.length - 1 - idx;
        const yPos = Math.max(
          0,
          reversedIdx * (NODE_SIZE + CONNECTOR_HEIGHT + 40) - 100,
        );
        scrollRef.current?.scrollTo({ y: yPos, animated: true });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [visible, currentLevel]);

  // Show levels bottom-to-top (level 1 at bottom, 10 at top)
  const reversed = [...LEVELS].reverse();

  /** How far the kid's stars fill toward a specific locked level (from previous level) */
  const getLockedProgress = (lvl: LevelDef): number => {
    const prevIdx = LEVELS.findIndex((l) => l.level === lvl.level) - 1;
    if (prevIdx < 0) return 0;
    const prevStars = LEVELS[prevIdx].starsRequired;
    const range = lvl.starsRequired - prevStars;
    if (range <= 0) return 0;
    const filled = stars - prevStars;
    if (filled <= 0) return 0;
    return Math.min(Math.round((filled / range) * 100), 100);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <Text style={s.headerEmoji}>🗺️</Text>
          <Text style={s.title}>{isRTL ? "طريق المستويات" : "Level Road"}</Text>

          {/* Stars summary pill */}
          <View style={s.starsSummary}>
            <View style={s.starsPill}>
              <Text style={s.starsPillText}>⭐ {stars}</Text>
            </View>
            {nextLevelDef && (
              <Text style={s.nextHint}>
                {isRTL
                  ? `${starsToNext} نجمة لـ${nextLevelDef.emoji} ${nextLevelDef.titleAr}`
                  : `${starsToNext} more to ${nextLevelDef.emoji} ${nextLevelDef.titleEn}`}
              </Text>
            )}
          </View>

          {/* Next-level highlight card (if not maxed) */}
          {nextLevelDef && (
            <LinearGradient
              colors={["#FFF7ED", "#FEF3C7"]}
              style={s.nextCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={s.nextCardRow}>
                <LinearGradient
                  colors={nextLevelDef.gradient}
                  style={s.nextCardIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={{ fontSize: 22 }}>{nextLevelDef.emoji}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={s.nextCardLabel}>
                    {isRTL ? "المستوى التالي" : "Next Level"}
                  </Text>
                  <Text
                    style={[
                      s.nextCardTitle,
                      { color: nextLevelDef.gradient[1] },
                    ]}
                  >
                    {isRTL ? nextLevelDef.titleAr : nextLevelDef.titleEn}
                  </Text>
                </View>
                <View style={s.nextCardStars}>
                  <Text style={s.nextCardStarsNum}>{starsToNext}</Text>
                  <Text style={s.nextCardStarsLabel}>
                    {isRTL ? "نجمة" : "stars"}
                  </Text>
                </View>
              </View>
              <View style={s.nextProgressBg}>
                <LinearGradient
                  colors={nextLevelDef.gradient}
                  style={[s.nextProgressFill, { width: `${progress}%` as any }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={s.nextProgressText}>
                {stars} / {nextLevelDef.starsRequired} ⭐
              </Text>
            </LinearGradient>
          )}

          {/* Road */}
          <ScrollView
            ref={scrollRef}
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {reversed.map((lvl, idx) => {
              const isReached = lvl.level <= currentLevel;
              const isCurrent = lvl.level === currentLevel;
              const isNext = lvl.level === currentLevel + 1;
              const isLast = idx === reversed.length - 1;
              const nextLvl =
                idx < reversed.length - 1 ? reversed[idx + 1] : null;
              const connectorReached = nextLvl
                ? nextLvl.level < currentLevel
                : false;
              const connectorPartial =
                nextLvl && nextLvl.level === currentLevel;

              // For locked levels: how many more stars needed from current
              const starsNeededFromNow = Math.max(0, lvl.starsRequired - stars);
              // Progress of locked level (how much of the star range is filled)
              const lockedPct = !isReached ? getLockedProgress(lvl) : 0;

              return (
                <View key={lvl.level} style={s.nodeRow}>
                  {/* Node + connector column */}
                  <View style={s.nodeCol}>
                    {/* Node circle */}
                    {isReached ? (
                      <LinearGradient
                        colors={lvl.gradient}
                        style={[s.node, isCurrent && s.nodeCurrent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={s.nodeEmoji}>{lvl.emoji}</Text>
                        {isCurrent && <View style={s.currentRing} />}
                      </LinearGradient>
                    ) : (
                      <View style={[s.nodeLocked, isNext && s.nodeNext]}>
                        <Text
                          style={[s.lockedEmoji, isNext && { opacity: 0.8 }]}
                        >
                          {isNext ? lvl.emoji : "🔒"}
                        </Text>
                      </View>
                    )}

                    {/* Connector line to node below */}
                    {!isLast && (
                      <View style={s.connector}>
                        <View
                          style={[
                            s.connectorFill,
                            connectorReached && s.connectorReached,
                            connectorPartial && {
                              height: `${progress}%`,
                              backgroundColor: lvl.gradient[0],
                            },
                          ]}
                        />
                        <View style={[s.dot, { top: 12 }]} />
                        <View style={[s.dot, { top: 26 }]} />
                        <View style={[s.dot, { top: 40 }]} />
                      </View>
                    )}
                  </View>

                  {/* Info card */}
                  <View
                    style={[
                      s.infoCard,
                      isCurrent && s.infoCardCurrent,
                      isNext && s.infoCardNext,
                    ]}
                  >
                    <View style={s.infoRow}>
                      <Text
                        style={[
                          s.levelNum,
                          isReached
                            ? { color: lvl.gradient[1] }
                            : isNext
                              ? { color: lvl.gradient[1] }
                              : { color: "#D1D5DB" },
                        ]}
                      >
                        {isRTL ? `المستوى ${lvl.level}` : `Level ${lvl.level}`}
                      </Text>
                      {isCurrent && (
                        <View
                          style={[
                            s.youBadge,
                            { backgroundColor: lvl.gradient[0] + "30" },
                          ]}
                        >
                          <Text
                            style={[s.youBadgeText, { color: lvl.gradient[1] }]}
                          >
                            {isRTL ? "أنت هنا ✨" : "YOU ✨"}
                          </Text>
                        </View>
                      )}
                      {isNext && (
                        <View
                          style={[s.youBadge, { backgroundColor: "#FEF3C7" }]}
                        >
                          <Text style={[s.youBadgeText, { color: "#F59E0B" }]}>
                            {isRTL ? "التالي 🎯" : "NEXT 🎯"}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text
                      style={[
                        s.levelTitle,
                        !isReached && !isNext && { color: "#D1D5DB" },
                      ]}
                    >
                      {lvl.emoji} {isRTL ? lvl.titleAr : lvl.titleEn}
                    </Text>

                    {/* Star requirement row */}
                    <View style={s.starsRow}>
                      <Text
                        style={[
                          s.starsReqText,
                          isReached && { color: "#10B981" },
                        ]}
                      >
                        {isReached
                          ? isCurrent
                            ? isRTL
                              ? `⭐ ${lvl.starsRequired} نجمة (الحالي)`
                              : `⭐ ${lvl.starsRequired} stars (current)`
                            : isRTL
                              ? `✅ ${lvl.starsRequired} نجمة`
                              : `✅ ${lvl.starsRequired} stars`
                          : isRTL
                            ? `⭐ يحتاج ${lvl.starsRequired} نجمة`
                            : `⭐ Needs ${lvl.starsRequired} stars`}
                      </Text>
                      {!isReached && (
                        <View style={s.remainBadge}>
                          <Text style={s.remainText}>
                            {isRTL
                              ? `${starsNeededFromNow}−`
                              : `${starsNeededFromNow} to go`}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Progress bar for current level */}
                    {isCurrent && nextLevelDef && (
                      <View style={s.cardProgressBg}>
                        <LinearGradient
                          colors={lvl.gradient}
                          style={[
                            s.cardProgressFill,
                            { width: `${progress}%` as any },
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                      </View>
                    )}

                    {/* Mini progress for the immediate next level */}
                    {isNext && (
                      <View style={s.cardProgressBg}>
                        <LinearGradient
                          colors={lvl.gradient}
                          style={[
                            s.cardProgressFill,
                            { width: `${lockedPct}%` as any },
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Close button */}
          <Pressable
            style={({ pressed }) => [
              s.closeBtn,
              { transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}
            onPress={onClose}
          >
            <LinearGradient
              colors={["#F97316", "#FB923C"]}
              style={s.closeBtnInner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={s.closeBtnText}>{isRTL ? "إغلاق" : "Close"}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFF7ED",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: "88%",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 10,
  },
  headerEmoji: { fontSize: 36, textAlign: "center" },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1C1917",
    textAlign: "center",
    marginTop: 2,
  },

  // ── Stars Summary ──
  starsSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  starsPill: {
    backgroundColor: "#F59E0B",
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 4,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  starsPillText: { fontSize: 14, fontWeight: "900", color: "#fff" },
  nextHint: {
    fontSize: 12,
    fontWeight: "800",
    color: "#78716C",
  },

  // ── Next Level Card ──
  nextCard: {
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#F59E0B30",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  nextCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  nextCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  nextCardLabel: { fontSize: 11, fontWeight: "700", color: "#78716C" },
  nextCardTitle: { fontSize: 17, fontWeight: "900" },
  nextCardStars: { alignItems: "center" },
  nextCardStarsNum: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F59E0B",
  },
  nextCardStarsLabel: { fontSize: 10, fontWeight: "700", color: "#78716C" },
  nextProgressBg: {
    height: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 20,
    overflow: "hidden",
  },
  nextProgressFill: { height: "100%", borderRadius: 20 },
  nextProgressText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#78716C",
    textAlign: "center",
    marginTop: 4,
  },

  // ── Scrollable Road ──
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 8, paddingBottom: 20 },

  // ── Node Row ──
  nodeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  nodeCol: { alignItems: "center", width: NODE_SIZE },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nodeCurrent: {
    width: NODE_SIZE + 8,
    height: NODE_SIZE + 8,
    borderRadius: (NODE_SIZE + 8) / 2,
    borderWidth: 3,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  currentRing: {
    position: "absolute",
    width: NODE_SIZE + 20,
    height: NODE_SIZE + 20,
    borderRadius: (NODE_SIZE + 20) / 2,
    borderWidth: 2,
    borderColor: "rgba(255,215,0,0.3)",
  },
  nodeEmoji: { fontSize: 28 },
  nodeLocked: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    backgroundColor: "#F3F4F6",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  nodeNext: {
    borderColor: "#F59E0B50",
    borderWidth: 2.5,
    borderStyle: "dashed" as any,
    backgroundColor: "#FEF3C7",
  },
  lockedEmoji: { fontSize: 22, opacity: 0.5 },

  // ── Connector ──
  connector: {
    width: 6,
    height: CONNECTOR_HEIGHT,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    marginVertical: 2,
    overflow: "hidden",
    alignItems: "center",
  },
  connectorFill: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 0,
    borderRadius: 3,
  },
  connectorReached: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  dot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.6)",
  },

  // ── Info Card ──
  infoCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoCardCurrent: {
    borderWidth: 2,
    borderColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  infoCardNext: {
    borderWidth: 1.5,
    borderColor: "#F59E0B40",
    backgroundColor: "#FFFBF0",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  levelNum: { fontSize: 13, fontWeight: "900" },
  youBadge: {
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  youBadgeText: { fontSize: 10, fontWeight: "900" },
  levelTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1C1917",
    marginTop: 2,
  },

  // ── Stars requirement row ──
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  starsReqText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#78716C",
  },
  remainBadge: {
    backgroundColor: "#FEF3C7",
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  remainText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#F59E0B",
  },

  // ── Progress bar inside cards ──
  cardProgressBg: {
    height: 7,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 6,
  },
  cardProgressFill: { height: "100%", borderRadius: 20 },

  // ── Close Button ──
  closeBtn: { marginTop: 10 },
  closeBtnInner: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  closeBtnText: { fontSize: 16, fontWeight: "900", color: "white" },
});
