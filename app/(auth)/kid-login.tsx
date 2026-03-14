import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
  BackHandler,
  Platform,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useState, useRef, useCallback, useEffect } from "react";
import { T } from "@/constants/translations";
import { authService, detectGeoFromIP } from "@/services/auth";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { LinearGradient } from "expo-linear-gradient";
import type { Kid } from "@/types/database";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";
import { notificationService } from "@/services/notifications";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { CameraView, useCameraPermissions } from "expo-camera";

const { width: SW } = Dimensions.get("window");

/* ─── Brand tokens ──────────────────────────────────────────────
   Keep in sync with constants/theme.ts
   ────────────────────────────────────────────────────────────── */
const C = {
  /* Sky — deep but warm */
  skyDeep: "#0F1E35",
  skySurface: "#162945",
  skyCard: "#1E3554",

  /* Gold — stars & rewards */
  gold: "#FFC843",
  goldSoft: "#FFE89A",
  goldGlow: "rgba(255,200,67,0.22)",
  goldBorder: "rgba(255,200,67,0.30)",

  /* Coral — primary action (kid-friendly energy) */
  coral: "#FF6B4A",
  coralLight: "#FF9B82",
  coralGlow: "rgba(255,107,74,0.25)",

  /* Mint — secondary / success */
  mint: "#3DD9A4",
  mintSoft: "#B2F5E4",
  mintGlow: "rgba(61,217,164,0.20)",

  /* Violet accent */
  violet: "#A78BFA",
  violetGlow: "rgba(167,139,250,0.20)",

  /* Text */
  white: "#FFFFFF",
  cream: "#F0E8D8",
  muted: "#7A9BBC",
  dim: "#3D5876",

  /* Semantic */
  error: "#FF6B6B",
  errorSoft: "rgba(255,107,107,0.15)",
};

/* ─── Twinkling star particle ─────────────────────────────────── */
function StarParticle({
  x,
  y,
  size = 3,
  delay = 0,
  color = C.gold,
}: {
  x: number;
  y: number;
  size?: number;
  delay?: number;
  color?: string;
}) {
  const anim = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: anim,
      }}
    />
  );
}

/* ─── 8-pointed Islamic star ──────────────────────────────────── */
function StarShape({ size = 16, color = C.gold, opacity = 0.25 }) {
  const s = size * 0.6;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <View
        style={{
          position: "absolute",
          width: s,
          height: s,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: s,
          height: s,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

/* ─── Animated spring-scale button ───────────────────────────── */
function ScaleBtn({
  onPress,
  disabled,
  children,
  style,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const shrink = useCallback(
    () =>
      Animated.spring(scale, {
        toValue: 0.93,
        useNativeDriver: true,
        tension: 280,
        friction: 10,
      }).start(),
    [],
  );
  const grow = useCallback(
    () =>
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 280,
        friction: 10,
      }).start(),
    [],
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={shrink}
      onPressOut={grow}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ─── PIN dot display (custom — not raw text input dots) ─────── */
function PinDots({
  value,
  length = 4,
  color = C.coral,
}: {
  value: string;
  length?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 14,
        justifyContent: "center",
        marginVertical: 20,
      }}
    >
      {Array.from({ length }).map((_, i) => {
        const filled = i < value.length;
        return (
          <Animated.View
            key={i}
            style={[
              S.pinDot,
              {
                backgroundColor: filled ? color : "transparent",
                borderColor: filled ? color : C.dim,
                transform: [{ scale: filled ? 1.15 : 1 }],
                shadowColor: filled ? color : "transparent",
                shadowOpacity: filled ? 0.7 : 0,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
                elevation: filled ? 6 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/* ─── OTP segment display ────────────────────────────────────── */
function OtpDots({
  value,
  length = 6,
  color = C.gold,
}: {
  value: string;
  length?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        direction: "ltr",
        gap: 8,
        justifyContent: "center",
        marginVertical: 20,
      }}
    >
      {Array.from({ length }).map((_, i) => {
        const char = value[i];
        return (
          <View
            key={i}
            style={[
              S.otpBox,
              {
                borderColor: char ? color : C.dim,
                backgroundColor: char ? `${color}18` : "transparent",
                shadowColor: char ? color : "transparent",
                shadowOpacity: 0.4,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          >
            <Text style={[S.otpChar, { color: char ? color : C.dim }]}>
              {char || "·"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ─── Page shell (sky background + stars) ────────────────────── */
function SkyShell({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={[C.skyDeep, C.skySurface, "#0F2236"]}
      locations={[0, 0.55, 1]}
      style={{ flex: 1 }}
    >
      {/* Ambient glow blobs */}
      <View
        style={{
          position: "absolute",
          top: -80,
          right: -60,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: C.goldGlow,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 40,
          left: -80,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: C.mintGlow,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: "40%",
          right: -40,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: C.violetGlow,
        }}
      />

      {/* Star particles */}
      <StarParticle x={24} y={100} size={2.5} delay={0} color={C.gold} />
      <StarParticle
        x={SW - 36}
        y={80}
        size={3}
        delay={400}
        color={C.goldSoft}
      />
      <StarParticle x={60} y={200} size={2} delay={800} color={C.mint} />
      <StarParticle x={SW - 60} y={260} size={2.5} delay={200} color={C.gold} />
      <StarParticle x={44} y={380} size={2} delay={1200} color={C.violet} />
      <StarParticle x={SW - 44} y={420} size={3} delay={600} color={C.gold} />
      <StarParticle x={100} y={500} size={2} delay={1000} color={C.mint} />
      <StarParticle
        x={SW - 100}
        y={540}
        size={2.5}
        delay={300}
        color={C.goldSoft}
      />

      {/* Islamic star ornaments */}
      <View style={{ position: "absolute", top: 120, left: 20 }}>
        <StarShape size={20} color={C.gold} opacity={0.18} />
      </View>
      <View style={{ position: "absolute", top: 180, right: 28 }}>
        <StarShape size={14} color={C.mint} opacity={0.2} />
      </View>
      <View style={{ position: "absolute", bottom: 200, left: 32 }}>
        <StarShape size={16} color={C.violet} opacity={0.16} />
      </View>
      <View style={{ position: "absolute", bottom: 280, right: 24 }}>
        <StarShape size={22} color={C.gold} opacity={0.14} />
      </View>

      {children}
    </LinearGradient>
  );
}

/* ─── Glass card panel ────────────────────────────────────────── */
function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View style={[S.glassCard, style]}>
      {/* Subtle top shine */}
      <View style={S.cardShine} />
      {children}
    </View>
  );
}

/* ─── Back button ─────────────────────────────────────────────── */
function BackBtn({
  onPress,
  isRTL = false,
}: {
  onPress: () => void;
  isRTL?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        S.backBtn,
        pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] },
      ]}
      onPress={onPress}
    >
      <LinearGradient colors={[C.skySurface, C.skyCard]} style={S.backBtnGrad}>
        <Text style={S.backBtnText}>{isRTL ? "→" : "←"}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/* ─── Primary action button ──────────────────────────────────── */
function ActionBtn({
  label,
  onPress,
  disabled,
  colors = [C.coral, "#E85A3C"],
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colors?: [string, string];
}) {
  return (
    <ScaleBtn
      onPress={onPress}
      disabled={disabled}
      style={{ width: "100%", marginTop: 6 }}
    >
      <LinearGradient
        colors={disabled ? ["#3D5876", "#2E4260"] : colors}
        style={[S.actionBtn, disabled && { shadowOpacity: 0 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Gloss highlight */}
        <View style={S.actionBtnGloss} />
        <Text style={S.actionBtnText}>{label}</Text>
      </LinearGradient>
    </ScaleBtn>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN SCREEN
   ═══════════════════════════════════════════════════════════════ */
type Step =
  | "choose-method"
  | "qr-scan"
  | "email"
  | "otp"
  | "kid-picker"
  | "kid-pin";

export default function KidLoginScreen() {
  const { session, kids, activeKid, role, setActiveKid, setRole, family } =
    useAuth();
  const { lang } = useLang();
  const t = T[lang];
  const isRTL = lang === "ar";

  const [step, setStep] = useState<Step>("choose-method");
  const [parentEmail, setParentEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [kidPin, setKidPin] = useState("");
  const [selectedKid, setSelectedKid] = useState<Kid | null>(null);
  const [pinError, setPinError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { toast, showToast } = useToast();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [qrScanned, setQrScanned] = useState(false);

  /* Slide-in animation per step */
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    slideAnim.setValue(30);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 180,
        friction: 14,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (step === "otp") setResendCooldown(60);
  }, [step]);
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Auto-resume to kid-picker if returning with an OTP-verified session
  useEffect(() => {
    if (
      (step === "choose-method" || step === "email") &&
      session &&
      kids.length > 0 &&
      role === "kid" &&
      !activeKid
    ) {
      setStep("kid-picker");
    }
  }, [session, kids, role, activeKid, step]);

  // Android back button: confirm sign-out on kid-picker
  useEffect(() => {
    if (step !== "kid-picker") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      showSignOutConfirm();
      return true;
    });
    return () => handler.remove();
  }, [step]);

  const showSignOutConfirm = () => {
    Alert.alert(
      isRTL ? "تسجيل الخروج؟" : "Sign Out?",
      isRTL
        ? "سيتم تسجيل خروجك وستحتاج لإدخال رمز التحقق مرة أخرى"
        : "You'll be signed out and will need to verify OTP again.",
      [
        { text: isRTL ? "إلغاء" : "Cancel", style: "cancel" },
        {
          text: isRTL ? "تسجيل الخروج" : "Sign Out",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
            setOtpCode("");
            setParentEmail("");
            setSelectedKid(null);
            setStep("choose-method");
          },
        },
      ],
    );
  };

  const animStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }],
  };

  const handleSendOTP = async () => {
    if (!parentEmail.includes("@")) return;
    setLoading(true);
    try {
      await authService.sendKidOTP(parentEmail);
      showToast(t.otpSent);
      setStep("otp");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length < 6) return;
    setLoading(true);
    try {
      // Set role BEFORE verify so that loadFamilyData (triggered by auth
      // state change inside verifyKidOTP) sees role="kid" and does NOT
      // auto-set activeKid or promote to "parent".
      setRole("kid");
      await authService.verifyKidOTP(parentEmail, otpCode);
      setStep("kid-picker");
    } catch (e: any) {
      setRole(null); // reset on failure
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      await authService.sendKidOTP(parentEmail);
      showToast(t.otpSent);
      setResendCooldown(60);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleQRScanned = async (data: string) => {
    if (qrScanned || loading) return;
    setQrScanned(true);
    setLoading(true);
    try {
      // Extract token from URL: tasbih://kid-login?token=<token>
      let token = data;
      try {
        const url = new URL(data);
        token = url.searchParams.get("token") || data;
      } catch {
        // If not a valid URL, use raw data
      }

      const kid = await authService.verifyKidQR(token);
      if (!kid) {
        showToast(t.qrExpired, "error");
        setQrScanned(false);
        setLoading(false);
        return;
      }

      // Fetch full kid row for kid-pin step
      const { data: fullKid, error } = await supabase
        .from("kids")
        .select("*")
        .eq("id", kid.id)
        .single();

      if (error || !fullKid) {
        showToast(t.qrExpired, "error");
        setQrScanned(false);
        setLoading(false);
        return;
      }

      setSelectedKid(fullKid as Kid);
      setKidPin("");
      setPinError("");
      setStep("kid-pin");

      // Save device info in background (same as OTP flow)
      saveKidDeviceInfo(fullKid as Kid);
    } catch (e: any) {
      showToast(e.message || t.qrExpired, "error");
      setQrScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKid = (kid: Kid) => {
    setSelectedKid(kid);
    setKidPin("");
    setPinError("");
    setStep("kid-pin");
  };

  const saveKidDeviceInfo = async (kid: Kid) => {
    try {
      if (!family?.id) return;
      const geo = await detectGeoFromIP();
      const geoFields = {
        ip_address: geo.ip,
        country: geo.country,
        city: geo.city,
        region: geo.region,
        timezone: geo.timezone,
        isp: geo.isp,
      };

      // Try to get push token and register with geo info
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        const projectId =
          process.env.EXPO_PUBLIC_PROJECT_ID ||
          Constants.expoConfig?.extra?.eas?.projectId;
        if (projectId) {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
          });
          await notificationService.registerToken(
            family.id,
            kid.id,
            tokenData.data,
            Platform.OS,
            geoFields,
          );
          return;
        }
      }

      // Fallback: update existing device_token row with geo info only
      await supabase
        .from("device_tokens")
        .update(geoFields)
        .eq("family_id", family.id)
        .eq("kid_id", kid.id);
    } catch (err) {
      console.warn("Failed to save kid device info:", err);
    }
  };

  const handleVerifyKidPin = async () => {
    if (!selectedKid) return;
    setLoading(true);
    setPinError("");
    try {
      if (!selectedKid.pin_hash) {
        setActiveKid(selectedKid);
        setRole("kid");
        // Save device info in background (don't block navigation)
        saveKidDeviceInfo(selectedKid);
        router.replace("/(tabs)/home");
        return;
      }
      if (kidPin.length !== 4) {
        setPinError(t.enter4Digits);
        setLoading(false);
        return;
      }
      try {
        await authService.verifyKidPin(selectedKid.id, kidPin);
      } catch {
        setPinError(t.incorrectPin);
        setKidPin("");
        setLoading(false);
        return;
      }
      setActiveKid(selectedKid);
      setRole("kid");
      // Save device info in background (don't block navigation)
      saveKidDeviceInfo(selectedKid);
      router.replace("/(tabs)/home");
    } finally {
      setLoading(false);
    }
  };

  /* ── Step: Kid PIN ──────────────────────────────────────────── */
  if (step === "kid-pin" && selectedKid) {
    return (
      <SkyShell>
        <Toast toast={toast} />
        <BackBtn
          isRTL={isRTL}
          onPress={() => {
            setSelectedKid(null);
            setKidPin("");
            setPinError("");
            // If we came from QR scan (no session), go back to choose-method
            // If we came from OTP flow (has session + kids), go back to kid-picker
            setStep(
              session && kids.length > 0 ? "kid-picker" : "choose-method",
            );
          }}
        />
        <View style={S.centerWrap}>
          <Animated.View style={[{ width: "100%" }, animStyle]}>
            <GlassCard>
              {/* Big avatar with orbital ring */}
              <View style={S.avatarOrbitWrap}>
                <View style={[S.avatarOrbit, { borderColor: C.goldBorder }]} />
                <View style={S.avatarOrbitInner}>
                  <Text style={S.avatarEmoji}>
                    {selectedKid.avatar || selectedKid.avatar_emoji || "🌟"}
                  </Text>
                </View>
                {/* Sparkle dots on orbit */}
                <View
                  style={[
                    S.orbitDot,
                    { top: -4, left: "50%", backgroundColor: C.gold },
                  ]}
                />
                <View
                  style={[
                    S.orbitDot,
                    { bottom: -4, left: "50%", backgroundColor: C.mint },
                  ]}
                />
                <View
                  style={[
                    S.orbitDot,
                    { left: -4, top: "50%", backgroundColor: C.violet },
                  ]}
                />
              </View>

              <Text style={S.kidGreeting}>
                {isRTL
                  ? `مرحباً ${selectedKid.display_name || selectedKid.name}!`
                  : `Hey ${selectedKid.display_name || selectedKid.name}! 👋`}
              </Text>
              <Text style={S.cardSub}>
                {selectedKid.pin_hash ? t.enterYourPin : t.tapEnter}
              </Text>

              {!!selectedKid.pin_hash && (
                <>
                  <PinDots value={kidPin} length={4} color={C.coral} />
                  <TextInput
                    style={S.hiddenInput}
                    value={kidPin}
                    onChangeText={(v) => {
                      setKidPin(v.replace(/\D/g, ""));
                      setPinError("");
                    }}
                    keyboardType="number-pad"
                    maxLength={4}
                    autoFocus
                  />
                  {pinError !== "" && (
                    <View style={S.errorPill}>
                      <Text style={S.errorPillText}>⚠️ {pinError}</Text>
                    </View>
                  )}
                </>
              )}

              <ActionBtn
                label={loading ? "⏳  ..." : `${t.enterBtn}  🚀`}
                onPress={handleVerifyKidPin}
                disabled={
                  loading || (!!selectedKid.pin_hash && kidPin.length < 4)
                }
                colors={[C.coral, "#E85A3C"]}
              />
            </GlassCard>
          </Animated.View>
        </View>
      </SkyShell>
    );
  }

  /* ── Step: Kid Picker ───────────────────────────────────────── */
  if (step === "kid-picker") {
    return (
      <SkyShell>
        <Toast toast={toast} />
        <ScrollView
          contentContainerStyle={S.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[{ width: "100%", alignItems: "center" }, animStyle]}
          >
            {/* Header */}
            <View style={S.pickerHeader}>
              <Text style={S.pageEmoji}>🌙</Text>
              <Text style={S.pageTitle}>{t.whoAreYou}</Text>
              <Text style={S.pageSub}>{t.pickProfile}</Text>
            </View>

            {/* Kid cards */}
            {kids.map((kid, index) => (
              <ScaleBtn
                key={kid.id}
                style={{ width: "100%", marginBottom: 12 }}
                onPress={() => handleSelectKid(kid)}
              >
                <View style={S.kidCard}>
                  <LinearGradient
                    colors={[C.skyCard, C.skySurface]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={S.kidCardGrad}
                  >
                    {/* Left glow based on index */}
                    <View
                      style={[
                        S.kidCardGlow,
                        {
                          backgroundColor: [
                            C.goldGlow,
                            C.mintGlow,
                            C.coralGlow,
                            C.violetGlow,
                          ][index % 4],
                        },
                      ]}
                    />

                    {/* Avatar */}
                    <View style={S.kidCardAvatar}>
                      <Text style={{ fontSize: 38 }}>
                        {kid.avatar || kid.avatar_emoji || "🌟"}
                      </Text>
                      {/* Online indicator */}
                      <View style={S.avatarDot} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={S.kidName}>
                        {kid.display_name || kid.name}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <View style={S.starPill}>
                          <Text style={S.starPillText}>
                            ⭐ {(kid.stars || 0).toLocaleString()}
                          </Text>
                        </View>
                        {kid.streak > 0 && (
                          <View
                            style={[
                              S.starPill,
                              {
                                backgroundColor: "rgba(255,107,74,0.15)",
                                borderColor: "rgba(255,107,74,0.25)",
                              },
                            ]}
                          >
                            <Text
                              style={[S.starPillText, { color: C.coralLight }]}
                            >
                              🔥 {kid.streak}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Arrow circle */}
                    <View style={S.arrowCircle}>
                      <Text style={S.arrowText}>{isRTL ? "←" : "→"}</Text>
                    </View>
                  </LinearGradient>
                </View>
              </ScaleBtn>
            ))}

            <Pressable style={S.backLink} onPress={showSignOutConfirm}>
              <Text style={S.backLinkText}>{isRTL ? "→ رجوع" : "← Back"}</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SkyShell>
    );
  }

  /* ── Step: OTP Verification ─────────────────────────────────── */
  if (step === "otp") {
    return (
      <SkyShell>
        <Toast toast={toast} />
        <BackBtn
          isRTL={isRTL}
          onPress={() => {
            setStep("email");
            setOtpCode("");
          }}
        />
        <View style={S.centerWrap}>
          <Animated.View style={[{ width: "100%" }, animStyle]}>
            <GlassCard>
              {/* Icon with ring */}
              <View style={[S.iconRing, { borderColor: C.goldBorder }]}>
                <LinearGradient
                  colors={["rgba(255,200,67,0.18)", "rgba(255,200,67,0.06)"]}
                  style={S.iconRingInner}
                >
                  <Text style={{ fontSize: 40 }}>📱</Text>
                </LinearGradient>
              </View>

              <Text style={S.cardTitle}>{t.otpTitle}</Text>
              <Text style={S.cardSub}>{t.otpDesc}</Text>

              {/* Email pill */}
              <View style={S.emailPill}>
                <Text style={S.emailPillText}>📧 {parentEmail}</Text>
              </View>

              <OtpDots value={otpCode} length={6} color={C.gold} />

              {/* Hidden numeric input */}
              <TextInput
                style={[S.hiddenInput, { direction: "ltr" }]}
                value={otpCode}
                onChangeText={(v) => setOtpCode(v.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              <ActionBtn
                label={
                  loading
                    ? isRTL
                      ? "جاري التحقق..."
                      : "Verifying..."
                    : t.verifyOTP
                }
                onPress={handleVerifyOTP}
                disabled={loading || otpCode.length < 6}
                colors={[C.gold, "#E6A800"]}
              />

              <Pressable
                style={[S.backLink, { marginTop: 14 }]}
                onPress={handleResendOTP}
                disabled={loading || resendCooldown > 0}
              >
                <Text
                  style={[
                    S.backLinkText,
                    {
                      color: resendCooldown > 0 ? C.dim : C.gold,
                      opacity: resendCooldown > 0 ? 0.6 : 1,
                    },
                  ]}
                >
                  {resendCooldown > 0 ? `⏱  ${resendCooldown}s` : t.resend}
                </Text>
              </Pressable>
            </GlassCard>
          </Animated.View>
        </View>
      </SkyShell>
    );
  }

  /* ── Step: Choose Method (QR or OTP) ────────────────────────── */
  if (step === "choose-method") {
    return (
      <SkyShell>
        <Toast toast={toast} />
        <View style={S.centerWrap}>
          <Animated.View style={[{ width: "100%" }, animStyle]}>
            {/* Logo lockup */}
            <View style={S.logoLockup}>
              <View style={S.logoRing}>
                <LinearGradient
                  colors={[C.skySurface, C.skyCard]}
                  style={S.logoGrad}
                >
                  <Text style={{ fontSize: 36 }}>🧒</Text>
                </LinearGradient>
              </View>
              <Text style={S.logoTitle}>Athkari</Text>
              <Text style={S.logoSub}>
                {isRTL ? "حساب الأطفال" : "Kid's Login"}
              </Text>
            </View>

            <GlassCard style={{ marginTop: 20 }}>
              <Text style={S.cardTitle}>{t.kidLogin}</Text>
              <Text style={S.cardSub}>
                {isRTL ? "اختر طريقة الدخول" : "Choose how to log in"}
              </Text>

              {/* Option A: Scan QR Code — primary */}
              <ActionBtn
                label={t.scanQR}
                onPress={() => setStep("qr-scan")}
                disabled={false}
                colors={[C.coral, "#E85A3C"]}
              />

              <Text style={[S.cardSub, { marginTop: 14, marginBottom: 10 }]}>
                {isRTL ? "— أو —" : "— or —"}
              </Text>

              {/* Option B: OTP — secondary fallback */}
              <Pressable style={S.backLink} onPress={() => setStep("email")}>
                <Text style={[S.backLinkText, { color: C.gold }]}>
                  {t.sendCodeToParent}
                </Text>
              </Pressable>
            </GlassCard>

            <Pressable
              style={[S.backLink, { marginTop: 20 }]}
              onPress={() => router.back()}
            >
              <Text style={S.backLinkText}>{isRTL ? "→ رجوع" : "← Back"}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SkyShell>
    );
  }

  /* ── Step: QR Scanner ───────────────────────────────────────── */
  if (step === "qr-scan") {
    // Need camera permission
    if (!cameraPermission?.granted) {
      return (
        <SkyShell>
          <Toast toast={toast} />
          <BackBtn
            isRTL={isRTL}
            onPress={() => {
              setStep("choose-method");
              setQrScanned(false);
            }}
          />
          <View style={S.centerWrap}>
            <Animated.View style={[{ width: "100%" }, animStyle]}>
              <GlassCard>
                <Text style={{ fontSize: 56 }}>📷</Text>
                <Text style={S.cardTitle}>{t.cameraPermission}</Text>
                <ActionBtn
                  label={t.grantPermission}
                  onPress={async () => {
                    const result = await requestCameraPermission();
                    if (!result.granted && !result.canAskAgain) {
                      Linking.openSettings();
                    }
                  }}
                  colors={[C.coral, "#E85A3C"]}
                />
              </GlassCard>
            </Animated.View>
          </View>
        </SkyShell>
      );
    }

    return (
      <SkyShell>
        <Toast toast={toast} />
        <BackBtn
          isRTL={isRTL}
          onPress={() => {
            setStep("choose-method");
            setQrScanned(false);
          }}
        />
        <View style={S.centerWrap}>
          <Animated.View style={[{ width: "100%" }, animStyle]}>
            <GlassCard style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={[S.cardTitle, { marginBottom: 12 }]}>
                {t.scanQR}
              </Text>
              <Text style={[S.cardSub, { marginBottom: 14 }]}>
                {t.scanQRDesc}
              </Text>

              {/* Camera view */}
              <View style={S.qrCameraWrap}>
                <CameraView
                  style={S.qrCamera}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                  }}
                  onBarcodeScanned={
                    qrScanned
                      ? undefined
                      : (result) => {
                          if (result.data) handleQRScanned(result.data);
                        }
                  }
                />
                {/* Corner markers */}
                <View style={[S.qrCorner, { top: 0, left: 0 }]} />
                <View
                  style={[
                    S.qrCorner,
                    { top: 0, right: 0, transform: [{ rotate: "90deg" }] },
                  ]}
                />
                <View
                  style={[
                    S.qrCorner,
                    { bottom: 0, left: 0, transform: [{ rotate: "-90deg" }] },
                  ]}
                />
                <View
                  style={[
                    S.qrCorner,
                    { bottom: 0, right: 0, transform: [{ rotate: "180deg" }] },
                  ]}
                />
              </View>

              {loading && (
                <Text style={[S.cardSub, { marginTop: 10, color: C.gold }]}>
                  {t.scanning}
                </Text>
              )}
            </GlassCard>
          </Animated.View>
        </View>
      </SkyShell>
    );
  }

  /* ── Step: Email Entry (OTP fallback) ───────────────────────── */
  return (
    <SkyShell>
      <Toast toast={toast} />
      <View style={S.centerWrap}>
        <Animated.View style={[{ width: "100%" }, animStyle]}>
          {/* Logo lockup */}
          <View style={S.logoLockup}>
            <View style={S.logoRing}>
              <LinearGradient
                colors={[C.skySurface, C.skyCard]}
                style={S.logoGrad}
              >
                <Text style={{ fontSize: 36 }}>🧒</Text>
              </LinearGradient>
            </View>
            <Text style={S.logoTitle}>Athkari</Text>
            <Text style={S.logoSub}>
              {isRTL ? "حساب الأطفال" : "Kid's Login"}
            </Text>
          </View>

          <GlassCard style={{ marginTop: 20 }}>
            <Text style={S.cardTitle}>{t.kidLogin}</Text>
            <Text style={S.cardSub}>{t.kidLoginDesc}</Text>

            {/* Email field */}
            <View style={{ marginBottom: 18, width: "100%" }}>
              <Text style={S.fieldLabel}>📧 {t.parentEmail}</Text>
              <View style={S.fieldWrap}>
                <TextInput
                  style={[
                    S.fieldInput,
                    { direction: "ltr", textAlign: "left" },
                  ]}
                  value={parentEmail}
                  onChangeText={setParentEmail}
                  placeholder="parent@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={C.dim}
                />
              </View>
            </View>

            <ActionBtn
              label={
                loading ? (isRTL ? "جاري الإرسال..." : "Sending...") : t.sendOTP
              }
              onPress={handleSendOTP}
              disabled={loading || !parentEmail.includes("@")}
              colors={[C.coral, "#E85A3C"]}
            />

            {/* Trust strip */}
            <View style={S.trustStrip}>
              {["🔒 Safe", "👨‍👩‍👧 Family", "⚡ Fast"].map((item, i) => (
                <View key={i} style={S.trustChip}>
                  <Text style={S.trustChipText}>{item}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          <Pressable
            style={[S.backLink, { marginTop: 20 }]}
            onPress={() => setStep("choose-method")}
          >
            <Text style={S.backLinkText}>{isRTL ? "→ رجوع" : "← Back"}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SkyShell>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const S = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 80,
    paddingBottom: 32,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 80,
    paddingBottom: 48,
    alignItems: "center",
  },

  /* ── Glass card ── */
  glassCard: {
    width: "100%",
    backgroundColor: C.skyCard,
    borderRadius: 30,
    padding: 28,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 14,
    overflow: "hidden",
  },
  cardShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  /* ── Back button ── */
  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  backBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
  },
  backBtnText: { fontSize: 18, color: C.cream, fontWeight: "900" },

  /* ── Logo lockup ── */
  logoLockup: { alignItems: "center", gap: 6 },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  logoGrad: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: C.gold,
    letterSpacing: -0.5,
  },
  logoSub: { fontSize: 13, fontWeight: "700", color: C.muted },

  /* ── Titles ── */
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: C.white,
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 13,
    fontWeight: "600",
    color: C.muted,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 18,
  },
  kidGreeting: {
    fontSize: 24,
    fontWeight: "900",
    color: C.white,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 4,
  },

  /* ── Avatar orbit (kid PIN step) ── */
  avatarOrbitWrap: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarOrbit: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderStyle: "dashed",
  },
  avatarOrbitInner: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: C.skySurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,200,67,0.20)",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
  avatarEmoji: { fontSize: 44 },
  orbitDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
  },

  /* ── Icon ring (OTP step) ── */
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  iconRingInner: { flex: 1, alignItems: "center", justifyContent: "center" },

  /* ── Email pill ── */
  emailPill: {
    backgroundColor: "rgba(255,200,67,0.12)",
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  emailPillText: { fontSize: 13, fontWeight: "700", color: C.gold },

  /* ── PIN dots ── */
  pinDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
  },

  /* ── OTP boxes ── */
  otpBox: {
    width: 42,
    height: 52,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  otpChar: { fontSize: 22, fontWeight: "900" },

  /* ── Hidden input (behind PIN / OTP visual) ── */
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },

  /* ── Error pill ── */
  errorPill: {
    backgroundColor: C.errorSoft,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255,107,107,0.30)",
  },
  errorPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: C.error,
    textAlign: "center",
  },

  /* ── Action button ── */
  actionBtn: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  actionBtnGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  actionBtnText: {
    fontSize: 17,
    fontWeight: "900",
    color: C.white,
    letterSpacing: 0.3,
  },

  /* ── Field ── */
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  fieldWrap: {
    backgroundColor: C.skySurface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
    width: "100%",
  },
  fieldInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
    width: "100%",
  },

  /* ── Trust strip ── */
  trustStrip: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 18,
  },
  trustChip: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  trustChipText: { fontSize: 11, fontWeight: "700", color: C.muted },

  /* ── Kid picker header ── */
  pickerHeader: { alignItems: "center", marginBottom: 26, gap: 4 },
  pageEmoji: { fontSize: 56 },
  pageTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: C.white,
    letterSpacing: -0.4,
  },
  pageSub: { fontSize: 13, fontWeight: "600", color: C.muted },

  /* ── Kid card ── */
  kidCard: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  kidCardGrad: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    position: "relative",
    overflow: "hidden",
  },
  kidCardGlow: {
    position: "absolute",
    top: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  kidCardAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: C.skyDeep,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    position: "relative",
  },
  avatarDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.mint,
    borderWidth: 2,
    borderColor: C.skyCard,
  },
  kidName: {
    fontSize: 18,
    fontWeight: "900",
    color: C.white,
    letterSpacing: -0.2,
  },
  starPill: {
    backgroundColor: "rgba(255,200,67,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255,200,67,0.25)",
    borderRadius: 50,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  starPillText: { fontSize: 12, fontWeight: "800", color: C.gold },
  arrowCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 18, color: C.cream, fontWeight: "900" },

  /* ── Back / link ── */
  backLink: { padding: 10, alignItems: "center" },
  backLinkText: { fontSize: 14, fontWeight: "800", color: C.muted },

  /* ── QR Scanner ── */
  qrCameraWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
    marginBottom: 8,
  },
  qrCamera: {
    flex: 1,
  },
  qrCorner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderColor: C.coral,
    borderTopLeftRadius: 8,
  },
});
