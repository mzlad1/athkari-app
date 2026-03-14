import { View, TextInput, StyleSheet, Text, Animated } from "react-native";
import { useRef, useEffect } from "react";
import { COLORS } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
  isRTL?: boolean;
  error?: boolean;
}

export function PinInput({
  value,
  onChange,
  length = 4,
  label,
  isRTL,
  error = false,
}: PinInputProps) {
  const inputRef = useRef<TextInput>(null);

  // Shake animation on error
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [error]);

  // Per-dot pop animation
  const popAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(1)),
  ).current;

  const prevLen = useRef(0);
  useEffect(() => {
    const idx = value.length - 1;
    if (value.length > prevLen.current && idx >= 0 && idx < length) {
      Animated.sequence([
        Animated.timing(popAnims[idx], {
          toValue: 1.25,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(popAnims[idx], {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevLen.current = value.length;
  }, [value]);

  const handleChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, length);
    onChange(digits);
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, isRTL && { textAlign: "right" }]}>
          {label}
        </Text>
      )}

      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {Array.from({ length }).map((_, i) => {
          const isFilled = i < value.length;
          const isActive = i === value.length;
          const hasError = error && value.length === length;

          return (
            <Animated.View
              key={i}
              style={[styles.dotWrap, { transform: [{ scale: popAnims[i] }] }]}
            >
              {isFilled ? (
                <LinearGradient
                  colors={
                    hasError ? ["#EF4444", "#DC2626"] : ["#7C3AED", "#9333EA"]
                  }
                  style={styles.dotFilled}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.dotBullet} />
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.dotEmpty,
                    isActive && styles.dotActive,
                    hasError && styles.dotError,
                  ]}
                />
              )}
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* Invisible input captures keyboard */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        secureTextEntry
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginVertical: 18 },

  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#78716C",
    marginBottom: 16,
  },

  dotsRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 8,
  },

  dotWrap: {
    width: 54,
    height: 54,
  },

  // Filled dot — gradient square
  dotFilled: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  dotBullet: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  // Empty dot
  dotEmpty: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    borderWidth: 2,
    borderColor: "#FDE68A",
  },

  // Currently active (next to fill)
  dotActive: {
    borderColor: "#7C3AED",
    borderWidth: 2.5,
    backgroundColor: "#EDE9FE",
  },

  // Error state
  dotError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEE2E2",
  },

  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: 54,
  },
});
