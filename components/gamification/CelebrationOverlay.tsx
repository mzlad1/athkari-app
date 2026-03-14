import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

const { width: SW, height: SH } = Dimensions.get("window");

export type CelebrationType =
  | "confetti"
  | "stars_rain"
  | "fireworks"
  | "emoji_burst"
  | "balloons"
  | "sparkle"
  | "golden_glow"
  | "none";

export const CELEBRATION_OPTIONS: {
  id: CelebrationType;
  icon: string;
  labelEn: string;
  labelAr: string;
}[] = [
  {
    id: "confetti",
    icon: "\uD83C\uDF8A",
    labelEn: "Confetti",
    labelAr:
      "\u0642\u0635\u0627\u0635\u0627\u062A \u0645\u0644\u0648\u0646\u0629",
  },
  {
    id: "stars_rain",
    icon: "\u2B50",
    labelEn: "Stars Rain",
    labelAr: "\u0645\u0637\u0631 \u0627\u0644\u0646\u062C\u0648\u0645",
  },
  {
    id: "fireworks",
    icon: "\uD83C\uDF86",
    labelEn: "Fireworks",
    labelAr: "\u0623\u0644\u0639\u0627\u0628 \u0646\u0627\u0631\u064A\u0629",
  },
  {
    id: "emoji_burst",
    icon: "\uD83C\uDF89",
    labelEn: "Emoji Burst",
    labelAr: "\u0627\u0646\u0641\u062C\u0627\u0631 \u0631\u0645\u0648\u0632",
  },
  {
    id: "balloons",
    icon: "\uD83C\uDF88",
    labelEn: "Balloons",
    labelAr: "\u0628\u0627\u0644\u0648\u0646\u0627\u062A",
  },
  {
    id: "sparkle",
    icon: "\u2728",
    labelEn: "Sparkle",
    labelAr: "\u0628\u0631\u064A\u0642",
  },
  {
    id: "golden_glow",
    icon: "\uD83C\uDF1F",
    labelEn: "Golden Glow",
    labelAr: "\u0648\u0647\u062C \u0630\u0647\u0628\u064A",
  },
  {
    id: "none",
    icon: "\uD83D\uDEAB",
    labelEn: "None",
    labelAr: "\u0628\u062F\u0648\u0646",
  },
];

interface Props {
  type?: CelebrationType;
  title: string;
  subtitle?: string;
  stars?: number;
  onDismiss?: () => void;
  autoDismissMs?: number;
  isRTL?: boolean;
}

const PARTICLE_COUNT = 40;
const CONFETTI_COLORS = [
  "#FFD700",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#FF69B4",
  "#7C3AED",
  "#F59E0B",
];
const STAR_EMOJIS = ["\u2B50", "\uD83C\uDF1F", "\u2728", "\uD83D\uDCAB"];
const BURST_EMOJIS = [
  "\uD83C\uDF89",
  "\uD83C\uDF8A",
  "\uD83C\uDFC6",
  "\uD83E\uDD29",
  "\u2B50",
  "\u2728",
  "\uD83D\uDCAA",
  "\uD83C\uDF1F",
  "\uD83D\uDC4F",
  "\u2764\uFE0F",
];
const BALLOON_COLORS = [
  "#FF6B6B",
  "#FFD93D",
  "#6BCB77",
  "#4D96FF",
  "#9B59B6",
  "#FF69B4",
];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function ConfettiParticles() {
  const anims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => {
      const startX = randomBetween(0, SW);
      return {
        x: new Animated.Value(startX),
        startX,
        y: new Animated.Value(-40),
        rotate: new Animated.Value(0),
        opacity: new Animated.Value(1),
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: randomBetween(6, 14),
        isRound: Math.random() > 0.5,
      };
    }),
  ).current;

  useEffect(() => {
    anims.forEach((p, i) => {
      const delay = i * 40;
      const duration = randomBetween(1800, 3200);
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: SH + 40,
          duration,
          delay,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(p.x, {
          toValue: p.startX + randomBetween(-80, 80),
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: randomBetween(2, 8),
          duration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration,
          delay: delay + duration * 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <>
      {anims.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: p.size,
            height: p.isRound ? p.size : p.size * 2,
            borderRadius: p.isRound ? p.size / 2 : 2,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              {
                rotate: p.rotate.interpolate({
                  inputRange: [0, 8],
                  outputRange: ["0deg", "2880deg"],
                }),
              },
            ],
          }}
        />
      ))}
    </>
  );
}

function StarsRainParticles() {
  const anims = useRef(
    Array.from({ length: 30 }, () => {
      const startX = randomBetween(10, SW - 40);
      return {
        x: new Animated.Value(startX),
        startX,
        y: new Animated.Value(randomBetween(-200, -30)),
        scale: new Animated.Value(randomBetween(0.5, 1.5)),
        opacity: new Animated.Value(0),
        emoji: STAR_EMOJIS[Math.floor(Math.random() * STAR_EMOJIS.length)],
      };
    }),
  ).current;

  useEffect(() => {
    anims.forEach((p, i) => {
      const delay = i * 70;
      const duration = randomBetween(1500, 2800);
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: SH + 30,
          duration,
          delay,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad),
        }),
        Animated.sequence([
          Animated.timing(p.opacity, {
            toValue: 1,
            duration: 200,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: 0.3,
            duration: duration - 400,
            delay: delay + 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(p.x, {
          toValue: p.startX + randomBetween(-30, 30),
          duration,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <>
      {anims.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            fontSize: 24,
            opacity: p.opacity,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { scale: p.scale },
            ],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </>
  );
}

function FireworksParticles() {
  const centers = useMemo(
    () => [
      { cx: SW * 0.3, cy: SH * 0.25 },
      { cx: SW * 0.7, cy: SH * 0.2 },
      { cx: SW * 0.5, cy: SH * 0.35 },
    ],
    [],
  );

  const anims = useRef(
    centers.flatMap((c, ci) =>
      Array.from({ length: 14 }, (_, pi) => {
        const angle = (pi / 14) * Math.PI * 2;
        const dist = randomBetween(80, 160);
        return {
          x: new Animated.Value(c.cx),
          y: new Animated.Value(c.cy),
          opacity: new Animated.Value(0),
          targetX: c.cx + Math.cos(angle) * dist,
          targetY: c.cy + Math.sin(angle) * dist,
          color:
            CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          delay: ci * 400,
          size: randomBetween(4, 10),
        };
      }),
    ),
  ).current;

  useEffect(() => {
    anims.forEach((p) => {
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.parallel([
          Animated.timing(p.opacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(p.x, {
            toValue: p.targetX,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
          Animated.timing(p.y, {
            toValue: p.targetY,
            duration: 600,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
          }),
        ]),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <>
      {anims.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: [{ translateX: p.x }, { translateY: p.y }],
          }}
        />
      ))}
    </>
  );
}

function EmojiBurstParticles() {
  const anims = useRef(
    Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2;
      const dist = randomBetween(100, 200);
      return {
        x: new Animated.Value(SW / 2 - 12),
        y: new Animated.Value(SH / 2 - 12),
        scale: new Animated.Value(0),
        opacity: new Animated.Value(1),
        targetX: SW / 2 - 12 + Math.cos(angle) * dist,
        targetY: SH / 2 - 12 + Math.sin(angle) * dist,
        emoji: BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)],
      };
    }),
  ).current;

  useEffect(() => {
    anims.forEach((p, i) => {
      const delay = i * 30;
      Animated.parallel([
        Animated.spring(p.scale, {
          toValue: 1,
          tension: 50,
          friction: 5,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(p.x, {
          toValue: p.targetX,
          duration: 800,
          delay,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(p.y, {
          toValue: p.targetY,
          duration: 800,
          delay,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 600,
          delay: delay + 600,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <>
      {anims.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            fontSize: 28,
            opacity: p.opacity,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { scale: p.scale },
            ],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </>
  );
}

function BalloonParticles() {
  const anims = useRef(
    Array.from({ length: 12 }, () => ({
      x: new Animated.Value(randomBetween(30, SW - 60)),
      y: new Animated.Value(SH + 40),
      scale: new Animated.Value(randomBetween(0.7, 1.3)),
      opacity: new Animated.Value(1),
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
      wobble: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    anims.forEach((p, i) => {
      const delay = i * 120;
      const duration = randomBetween(2200, 3500);
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: -80,
          duration,
          delay,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 600,
          delay: delay + duration - 600,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(p.wobble, {
              toValue: 15,
              duration: 400,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.sin),
            }),
            Animated.timing(p.wobble, {
              toValue: -15,
              duration: 400,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.sin),
            }),
          ]),
        ),
      ]).start();
    });
  }, []);

  return (
    <>
      {anims.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: 36,
            height: 44,
            borderRadius: 18,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: [
              { translateX: Animated.add(p.x, p.wobble) },
              { translateY: p.y },
              { scale: p.scale },
            ],
          }}
        >
          <View
            style={{
              position: "absolute",
              bottom: -8,
              alignSelf: "center",
              width: 1,
              height: 8,
              backgroundColor: p.color,
            }}
          />
        </Animated.View>
      ))}
    </>
  );
}

function SparkleParticles() {
  const anims = useRef(
    Array.from({ length: 25 }, () => ({
      x: randomBetween(20, SW - 40),
      y: randomBetween(60, SH - 200),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    anims.forEach((p, i) => {
      const delay = i * 80;
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(p.scale, {
              toValue: randomBetween(0.8, 1.5),
              duration: 300,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(p.opacity, {
              toValue: 1,
              duration: 300,
              delay,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(p.scale, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(p.opacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(randomBetween(200, 600)),
        ]),
        { iterations: 3 },
      ).start();
    });
  }, []);

  return (
    <>
      {anims.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            fontSize: 20,
            opacity: p.opacity,
            transform: [{ scale: p.scale }],
          }}
        >
          {"\u2728"}
        </Animated.Text>
      ))}
    </>
  );
}

function GoldenGlowEffect() {
  const pulse = useRef(new Animated.Value(0.3)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ]),
      { iterations: 3 },
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 2.5,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(ringOpacity, {
              toValue: 0.6,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacity, {
              toValue: 0,
              duration: 1200,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 0.5,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
      { iterations: 3 },
    ).start();
  }, []);

  return (
    <>
      <Animated.View
        style={{
          position: "absolute",
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: "#FFD700",
          top: SH / 2 - 100,
          left: SW / 2 - 100,
          opacity: pulse,
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: 120,
          height: 120,
          borderRadius: 60,
          borderWidth: 3,
          borderColor: "#FFD700",
          top: SH / 2 - 60,
          left: SW / 2 - 60,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />
    </>
  );
}

function ParticleRenderer({ type }: { type: CelebrationType }) {
  switch (type) {
    case "confetti":
      return <ConfettiParticles />;
    case "stars_rain":
      return <StarsRainParticles />;
    case "fireworks":
      return <FireworksParticles />;
    case "emoji_burst":
      return <EmojiBurstParticles />;
    case "balloons":
      return <BalloonParticles />;
    case "sparkle":
      return <SparkleParticles />;
    case "golden_glow":
      return <GoldenGlowEffect />;
    default:
      return null;
  }
}

export function CelebrationOverlay({
  type = "confetti",
  title,
  subtitle,
  stars,
  onDismiss,
  autoDismissMs,
  isRTL = false,
}: Props) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const starsScale = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const trophyBounce = useRef(new Animated.Value(0)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(btnScale, {
      toValue: 0.93,
      useNativeDriver: true,
    }).start();
  }, []);

  const onPressOut = useCallback(() => {
    Animated.spring(btnScale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Trophy bounce
      Animated.sequence([
        Animated.timing(trophyBounce, {
          toValue: -12,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(trophyBounce, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.bounce,
        }),
      ]).start();

      if (stars) {
        Animated.spring(starsScale, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }).start();
      }
    });

    if (autoDismissMs && onDismiss) {
      const t = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(t);
    }
  }, []);

  if (type === "none") {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeIn }]}>
      <ParticleRenderer type={type} />

      <Animated.View
        style={[styles.cardOuter, { transform: [{ scale: scaleAnim }] }]}
      >
        {/* Decorative watermark emoji */}
        <Text style={styles.watermark}>{"\uD83C\uDF1F"}</Text>

        {/* Trophy icon */}
        <Animated.Text
          style={[
            styles.trophyIcon,
            { transform: [{ translateY: trophyBounce }] },
          ]}
        >
          {"\uD83C\uDFC6"}
        </Animated.Text>

        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {stars != null && stars > 0 && (
          <Animated.View
            style={[styles.starsPill, { transform: [{ scale: starsScale }] }]}
          >
            <LinearGradient
              colors={["#F59E0B", "#FBBF24"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.starsPillGradient}
            >
              <Text style={styles.starsText}>
                {"\u2B50"} +{stars}
              </Text>
            </LinearGradient>
          </Animated.View>
        )}

        {onDismiss && !autoDismissMs && (
          <Animated.View
            style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}
          >
            <Pressable
              onPress={onDismiss}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
            >
              <LinearGradient
                colors={["#F97316", "#FB923C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissText}>
                  {isRTL
                    ? "\u0645\u062A\u0627\u0628\u0639\u0629 \uD83D\uDE80"
                    : "Continue \uD83D\uDE80"}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,25,23,0.70)",
    zIndex: 200,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardOuter: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: "center",
    width: SW * 0.85,
    maxWidth: 360,
    zIndex: 210,
    overflow: "hidden",
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  watermark: {
    position: "absolute",
    top: -20,
    right: -20,
    fontSize: 120,
    opacity: 0.08,
  },
  trophyIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#1C1917",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#78716C",
    textAlign: "center",
    marginTop: 8,
  },
  starsPill: {
    marginTop: 18,
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  starsPillGradient: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  starsText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  btnWrap: {
    marginTop: 24,
    borderRadius: 20,
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  dismissBtn: {
    paddingVertical: 16,
    paddingHorizontal: 44,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
});
