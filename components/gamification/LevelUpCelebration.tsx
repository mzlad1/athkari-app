import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { LevelDef } from "@/constants/levels";

const { width: SW, height: SH } = Dimensions.get("window");
const PARTICLE_COUNT = 30;

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

const STAR_EMOJIS = ["⭐", "🌟", "✨", "💫", "🎉", "🏆"];

interface Props {
  level: LevelDef;
  onDismiss: () => void;
  isRTL: boolean;
}

function LevelStarParticles({ gradient }: { gradient: [string, string] }) {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => {
      const startX = randomBetween(0, SW);
      return {
        x: new Animated.Value(startX),
        startX,
        y: new Animated.Value(randomBetween(-80, -20)),
        opacity: new Animated.Value(1),
        scale: new Animated.Value(randomBetween(0.4, 1)),
        emoji: STAR_EMOJIS[Math.floor(Math.random() * STAR_EMOJIS.length)],
      };
    }),
  ).current;

  useEffect(() => {
    particles.forEach((p, i) => {
      const delay = i * 60;
      const dur = randomBetween(1600, 3000);
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: SH + 60,
          duration: dur,
          delay,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(p.x, {
          toValue: p.startX + randomBetween(-60, 60),
          duration: dur,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: dur,
          delay: delay + dur * 0.6,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  return (
    <>
      {particles.map((p, i) => (
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

export function LevelUpCelebration({ level, onDismiss, isRTL }: Props) {
  const mainScale = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );

    // Entrance animation sequence
    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(mainScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
        delay: 100,
      }),
      Animated.sequence([
        Animated.delay(300),
        Animated.spring(emojiScale, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Pulsing ring
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.6,
            duration: 1200,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 0.5,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();

    // Auto dismiss
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[s.overlay, { opacity: bgOpacity }]}>
      <LevelStarParticles gradient={level.gradient} />

      {/* Pulsing ring behind emoji */}
      <Animated.View
        style={[
          s.ring,
          {
            backgroundColor: level.gradient[0] + "40",
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />

      <Animated.View style={[s.content, { transform: [{ scale: mainScale }] }]}>
        {/* Big emoji */}
        <Animated.View
          style={[s.bigEmojiWrap, { transform: [{ scale: emojiScale }] }]}
        >
          <LinearGradient
            colors={level.gradient}
            style={s.emojiCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={s.bigEmoji}>{level.emoji}</Text>
          </LinearGradient>
        </Animated.View>

        <Text style={s.levelUpLabel}>
          {isRTL ? "🎉 ارتقيت!" : "🎉 LEVEL UP!"}
        </Text>
        <Text style={s.levelNumber}>
          {isRTL ? `المستوى ${level.level}` : `Level ${level.level}`}
        </Text>
        <Text style={s.levelTitle}>
          {isRTL ? level.titleAr : level.titleEn}
        </Text>

        <Pressable
          style={({ pressed }) => [
            s.dismissBtn,
            { transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}
          onPress={onDismiss}
        >
          <LinearGradient
            colors={level.gradient}
            style={s.dismissBtnInner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={s.dismissText}>
              {isRTL ? "يلا نكمل! 🚀" : "Let's go! 🚀"}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  ring: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  content: { alignItems: "center", paddingHorizontal: 32 },
  bigEmojiWrap: { marginBottom: 18 },
  emojiCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  bigEmoji: { fontSize: 56 },
  levelUpLabel: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFD700",
    letterSpacing: 3,
    marginBottom: 4,
  },
  levelNumber: {
    fontSize: 44,
    fontWeight: "900",
    color: "white",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  levelTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
    marginBottom: 28,
  },
  dismissBtn: {},
  dismissBtnInner: {
    borderRadius: 22,
    paddingHorizontal: 40,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  dismissText: { fontSize: 18, fontWeight: "900", color: "white" },
});
