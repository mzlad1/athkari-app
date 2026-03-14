import { View, StyleSheet, Animated, Dimensions } from "react-native";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

/* ─── Shimmer animation hook ─── */
function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.25,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return anim;
}

/* ─── Base bone (warm tinted) ─── */
function Bone({ style }: { style?: any }) {
  const opacity = useShimmer();
  return <Animated.View style={[styles.bone, style, { opacity }]} />;
}

/* ─── Preset shapes ─── */
export function SkeletonCircle({ size = 48 }: { size?: number }) {
  return <Bone style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

export function SkeletonRect({
  w,
  h,
  radius = 14,
}: {
  w: number | string;
  h: number;
  radius?: number;
}) {
  return <Bone style={{ width: w, height: h, borderRadius: radius }} />;
}

export function SkeletonLine({
  w = "100%",
  h = 14,
}: {
  w?: number | string;
  h?: number;
}) {
  return <Bone style={{ width: w, height: h, borderRadius: 7 }} />;
}

/* ─── Skeleton card wrapper ─── */
function SkeletonCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ──────────────────────────────────────────────────
   Page-level skeletons
────────────────────────────────────────────────── */

export function HomeSkeleton() {
  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.row, { marginBottom: 20, paddingHorizontal: 4 }]}>
        <SkeletonCircle size={48} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <SkeletonLine w={90} h={11} />
          <View style={{ height: 6 }} />
          <SkeletonLine w={160} h={17} />
        </View>
        <SkeletonRect w={52} h={30} radius={50} />
        <View style={{ width: 8 }} />
        <SkeletonRect w={52} h={30} radius={50} />
      </View>

      {/* Wird hero card */}
      <SkeletonCard style={{ marginBottom: 14 }}>
        <SkeletonRect w={"100%"} h={130} radius={22} />
      </SkeletonCard>

      {/* Challenge card */}
      <SkeletonCard style={{ marginBottom: 14 }}>
        <SkeletonRect w={"100%"} h={100} radius={22} />
      </SkeletonCard>

      {/* Progress card */}
      <SkeletonCard style={{ marginBottom: 20 }}>
        <SkeletonRect w={"100%"} h={72} radius={22} />
      </SkeletonCard>

      {/* Section title */}
      <SkeletonLine w={130} h={20} />
      <View style={{ height: 16 }} />

      {/* Category grid 3×2 */}
      {[0, 1].map((row) => (
        <View key={row} style={[styles.gridRow, { marginBottom: 12 }]}>
          {[0, 1, 2].map((col) => (
            <SkeletonRect
              key={col}
              w={(width - 72) / 3}
              h={(width - 72) / 3}
              radius={20}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function DhikrSkeleton() {
  return (
    <View style={[styles.page, { alignItems: "center", paddingTop: 60 }]}>
      {/* Header row */}
      <View
        style={[
          styles.row,
          { width: "100%", justifyContent: "space-between", marginBottom: 32 },
        ]}
      >
        <SkeletonCircle size={38} />
        <SkeletonRect w={80} h={30} radius={50} />
        <SkeletonRect w={44} h={30} radius={50} />
      </View>

      <SkeletonLine w={150} h={19} />
      <View style={{ height: 28 }} />

      {/* Arabic text block */}
      <SkeletonLine w={"82%"} h={26} />
      <View style={{ height: 10 }} />
      <SkeletonLine w={"60%"} h={17} />
      <View style={{ height: 44 }} />

      {/* Circular counter */}
      <SkeletonCircle size={190} />
      <View style={{ height: 32 }} />

      <SkeletonCircle size={62} />
      <View style={{ height: 10 }} />
      <SkeletonLine w={130} h={14} />
      <View style={{ height: 28 }} />

      {/* Progress dots */}
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ marginHorizontal: 5 }}>
            <SkeletonCircle size={11} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function BadgesSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonLine w={150} h={23} />
      <View style={{ height: 22 }} />

      {/* Stats row */}
      <View
        style={[
          styles.row,
          { justifyContent: "space-around", marginBottom: 28 },
        ]}
      >
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ alignItems: "center" }}>
            <SkeletonRect w={64} h={36} radius={14} />
            <View style={{ height: 7 }} />
            <SkeletonLine w={54} h={12} />
          </View>
        ))}
      </View>

      <SkeletonLine w={110} h={19} />
      <View style={{ height: 16 }} />

      {/* Badge rows */}
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard
          key={i}
          style={{
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <SkeletonCircle size={48} />
          <View style={{ flex: 1 }}>
            <SkeletonLine w={"60%"} h={14} />
            <View style={{ height: 8 }} />
            <SkeletonRect w={"100%"} h={9} radius={50} />
          </View>
        </SkeletonCard>
      ))}

      <View style={{ height: 24 }} />
      <SkeletonLine w={140} h={19} />
      <View style={{ height: 16 }} />

      {[1, 2, 3].map((i) => (
        <SkeletonCard
          key={i}
          style={{
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <SkeletonCircle size={34} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <SkeletonLine w={"50%"} h={14} />
          </View>
          <SkeletonCircle size={22} />
        </SkeletonCard>
      ))}
    </View>
  );
}

export function ChallengesSkeleton() {
  return (
    <View style={styles.page}>
      {/* Sub tabs */}
      <View style={[styles.row, { marginBottom: 22, gap: 10 }]}>
        <SkeletonRect w={96} h={36} radius={50} />
        <SkeletonRect w={96} h={36} radius={50} />
        <SkeletonRect w={96} h={36} radius={50} />
      </View>

      <SkeletonCard style={{ marginBottom: 16 }}>
        <SkeletonRect w={"100%"} h={64} radius={18} />
      </SkeletonCard>

      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard
          key={i}
          style={{
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <SkeletonCircle size={38} />
          <View style={{ flex: 1 }}>
            <SkeletonLine w={"52%"} h={14} />
            <View style={{ height: 5 }} />
            <SkeletonLine w={"32%"} h={12} />
          </View>
          <SkeletonRect w={54} h={26} radius={50} />
        </SkeletonCard>
      ))}
    </View>
  );
}

export function WirdSkeleton() {
  return (
    <View style={styles.page}>
      <SkeletonLine w={150} h={23} />
      <View style={{ height: 12 }} />
      <SkeletonRect w={"100%"} h={12} radius={50} />
      <View style={{ height: 7 }} />
      <SkeletonLine w={70} h={13} />
      <View style={{ height: 26 }} />

      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard
          key={i}
          style={{
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <SkeletonCircle size={26} />
          <View style={{ flex: 1 }}>
            <SkeletonLine w={"80%"} h={14} />
            <View style={{ height: 5 }} />
            <SkeletonLine w={"42%"} h={12} />
          </View>
        </SkeletonCard>
      ))}
    </View>
  );
}

export function ParentSkeleton() {
  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.row, { marginBottom: 22, gap: 14 }]}>
        <SkeletonCircle size={54} />
        <View style={{ flex: 1 }}>
          <SkeletonLine w={150} h={19} />
          <View style={{ height: 7 }} />
          <SkeletonLine w={110} h={13} />
        </View>
      </View>

      {/* Sub tabs */}
      <View style={[styles.row, { marginBottom: 22, gap: 10 }]}>
        <SkeletonRect w={84} h={36} radius={50} />
        <SkeletonRect w={84} h={36} radius={50} />
        <SkeletonRect w={84} h={36} radius={50} />
      </View>

      <SkeletonCard style={{ marginBottom: 12 }}>
        <SkeletonRect w={"100%"} h={104} radius={22} />
      </SkeletonCard>
      <SkeletonCard style={{ marginBottom: 22 }}>
        <SkeletonRect w={"100%"} h={104} radius={22} />
      </SkeletonCard>

      <View
        style={[
          styles.row,
          { justifyContent: "space-around", marginBottom: 22 },
        ]}
      >
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ alignItems: "center" }}>
            <SkeletonRect w={66} h={44} radius={16} />
            <View style={{ height: 7 }} />
            <SkeletonLine w={54} h={12} />
          </View>
        ))}
      </View>

      {[1, 2, 3].map((i) => (
        <SkeletonCard
          key={i}
          style={{
            marginBottom: 14,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <SkeletonLine w={"58%"} h={17} />
          <SkeletonRect w={48} h={26} radius={50} />
        </SkeletonCard>
      ))}
    </View>
  );
}

export function NotificationsSkeleton() {
  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.row, { marginBottom: 22, gap: 14 }]}>
        <SkeletonCircle size={38} />
        <SkeletonLine w={150} h={23} />
      </View>

      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard
          key={i}
          style={{
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <SkeletonCircle size={38} />
          <View style={{ flex: 1 }}>
            <SkeletonLine w={"68%"} h={14} />
            <View style={{ height: 5 }} />
            <SkeletonLine w={"90%"} h={12} />
          </View>
          <SkeletonLine w={44} h={11} />
        </SkeletonCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: "#FDE68A", // warm amber tint vs cold grey
  },
  page: {
    padding: 18,
    paddingTop: 22,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#FEF9F0",
    borderRadius: 20,
    padding: 14,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
