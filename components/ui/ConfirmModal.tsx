import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmModal({
  config,
  onClose,
}: {
  config: ConfirmConfig | null;
  onClose: () => void;
}) {
  if (!config) return null;

  const confirmColors: [string, string] = config.destructive
    ? ["#EF4444", "#DC2626"]
    : ["#7C3AED", "#9333EA"];

  const headerEmoji = config.destructive ? "⚠️" : "✨";

  return (
    <Modal visible transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {/* Emoji header */}
          <View
            style={[
              styles.emojiCircle,
              config.destructive && styles.emojiCircleDanger,
            ]}
          >
            <Text style={{ fontSize: 32 }}>{headerEmoji}</Text>
          </View>

          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.message}>{config.message}</Text>

          <View style={styles.row}>
            {/* Cancel */}
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>
                {config.cancelText ?? "Cancel"}
              </Text>
            </Pressable>

            {/* Confirm */}
            <Pressable
              style={styles.confirmWrap}
              onPress={() => {
                onClose();
                config.onConfirm();
              }}
            >
              <LinearGradient
                colors={confirmColors}
                style={styles.confirmBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.confirmText}>
                  {config.confirmText ?? "OK"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(28,25,23,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },

  emojiCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emojiCircleDanger: { backgroundColor: "#FEE2E2" },

  title: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1C1917",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    color: "#78716C",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  row: { flexDirection: "row", gap: 12, width: "100%" },

  cancelBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { color: "#78716C", fontWeight: "800", fontSize: 15 },

  confirmWrap: { flex: 1, borderRadius: 16, overflow: "hidden" },
  confirmBtn: { paddingVertical: 14, alignItems: "center", borderRadius: 16 },
  confirmText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
