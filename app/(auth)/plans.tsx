import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Animated,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePlans } from "@/hooks/usePlans";
import { plansService } from "@/services/plans";
import { subscriptionService } from "@/services/subscriptions";
import { supabase } from "@/services/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";

const C = {
  amber: "#D97706",
  amberLight: "#F59E0B",
  amberSoft: "#FEF3C7",
  amberGlow: "rgba(217,119,6,0.10)",
  amberBorder: "rgba(217,119,6,0.22)",
  teal: "#0D9488",
  tealSoft: "#F0FDFA",
  tealBorder: "rgba(13,148,136,0.22)",
  green: "#059669",
  greenSoft: "#ECFDF5",
  violet: "#7C3AED",
  violetSoft: "#EDE9FE",
  ink: "#1C1017",
  inkMid: "#44403C",
  inkFaint: "#78716C",
  cream: "#FFFBF5",
  creamWarm: "#FFF7ED",
  white: "#FFFFFF",
  border: "rgba(217,119,6,0.13)",
  red: "#DC2626",
};

const FEATURES_EN = [
  { icon: "📿", text: "All sections & adhkar" },
  { icon: "🎙️", text: "AI voice with Sheikh voices" },
  { icon: "🏆", text: "Unlimited challenges" },
  { icon: "📊", text: "Weekly parent reports" },
  { icon: "🌙", text: "Bedtime mode" },
  { icon: "🚫", text: "Ad-free experience" },
];
const FEATURES_AR = [
  { icon: "📿", text: "جميع الأقسام والأذكار" },
  { icon: "🎙️", text: "صوت AI بأصوات مشايخ" },
  { icon: "🏆", text: "تحديات غير محدودة" },
  { icon: "📊", text: "تقارير أسبوعية للوالدين" },
  { icon: "🌙", text: "وضع قبل النوم" },
  { icon: "🚫", text: "بدون إعلانات" },
];

/* ── Plan card ──────────────────────────────────────────────── */
function PlanCard({
  plan,
  selected,
  onPress,
  annual,
  isRTL,
}: {
  plan: any;
  selected: boolean;
  onPress: () => void;
  annual: boolean;
  isRTL: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const isPopular = plan.tag === "popular";
  const isBestValue = plan.tag === "best_value";

  const tagColor = isPopular ? C.violet : isBestValue ? C.teal : C.amber;
  const tagBg = isPopular
    ? C.violetSoft
    : isBestValue
      ? C.tealSoft
      : C.amberSoft;
  const tagLabel = isPopular
    ? isRTL
      ? "الأكثر شعبية"
      : "Popular"
    : isBestValue
      ? isRTL
        ? "الأفضل قيمة"
        : "Best Value"
      : null;

  const press = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.97,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();
    onPress();
  };

  const borderColor = selected
    ? C.amber
    : isPopular
      ? C.violet
      : isBestValue
        ? C.teal
        : "rgba(217,119,6,0.10)";

  return (
    <Animated.View
      style={[
        P.planCard,
        {
          borderColor,
          transform: [{ scale }],
          shadowColor: selected ? C.amber : "transparent",
          shadowOpacity: selected ? 0.18 : 0,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: selected ? 8 : 3,
        },
      ]}
    >
      {(isPopular || isBestValue) && !selected && (
        <View style={[P.cardGlowBorder, { borderColor: tagColor + "55" }]} />
      )}

      {selected && (
        <LinearGradient
          colors={["rgba(217,119,6,0.06)", "rgba(217,119,6,0.02)"]}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      <Pressable onPress={press} style={P.planCardInner}>
        {tagLabel && (
          <View
            style={[
              P.tagBadge,
              { backgroundColor: tagBg, borderColor: tagColor + "44" },
            ]}
          >
            <Text style={[P.tagText, { color: tagColor }]}>{tagLabel}</Text>
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={P.planName}>
              {isRTL ? plan.name_ar : plan.name_en}
            </Text>
            <Text style={P.planMeta}>
              {isRTL ? plan.name_en : plan.name_ar} · {plan.max_kids}{" "}
              {isRTL ? "أطفال" : "kids"}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={[P.planPrice, { color: selected ? C.amber : C.ink }]}>
              ${annual ? plan.price_annual : plan.price_monthly}
            </Text>
            <Text style={P.planCycle}>
              {annual ? (isRTL ? "/سنة" : "/yr") : isRTL ? "/شهر" : "/mo"}
            </Text>
          </View>
        </View>

        <View style={[P.planSelectRow, { opacity: selected ? 1 : 0 }]}>
          <View style={P.planSelectDot}>
            <Text style={{ fontSize: 8, color: C.white, fontWeight: "900" }}>
              ✓
            </Text>
          </View>
          <Text style={P.planSelectText}>{isRTL ? "محدد" : "Selected"}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ── Feature row ────────────────────────────────────────────── */
function FeatureRow({
  icon,
  text,
  delay = 0,
}: {
  icon: string;
  text: string;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        P.featureRow,
        {
          opacity: anim,
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={P.featureIcon}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
      </View>
      <Text style={P.featureText}>{text}</Text>
    </Animated.View>
  );
}

export default function PlansScreen() {
  const [annual, setAnnual] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{
    valid: boolean;
    discount_pct?: number;
  } | null>(null);
  const [promoFocused, setPromoFocused] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const { plans, loading: isLoading } = usePlans();
  const { family, user, refreshFamily } = useAuth();
  const { toast, showToast } = useToast();

  // Ensure family is loaded (race condition after register)
  useEffect(() => {
    if (user && !family) {
      refreshFamily();
    }
  }, [user, family]);

  // Auto-select popular plan
  useEffect(() => {
    if (plans.length > 0 && selectedPlanId === null) {
      const popular = plans.find((p) => p.tag === "popular");
      setSelectedPlanId(popular?.id ?? plans[0].id);
    }
  }, [plans]);

  const handlePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await plansService.validatePromoCode(promoCode.trim());
      if (res) {
        setPromoResult({
          valid: true,
          discount_pct:
            res.discount_type === "percent"
              ? Number(res.discount_value)
              : undefined,
        });
        showToast(
          isRTL ? "تم تطبيق رمز الخصم!" : "Promo code applied!",
          "success",
        );
      } else {
        setPromoResult({ valid: false });
        showToast(isRTL ? "رمز غير صالح" : "Invalid promo code", "error");
      }
    } catch {
      showToast(isRTL ? "حدث خطأ" : "Something went wrong", "error");
    } finally {
      setPromoLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const getDiscountedPrice = (price: number) => {
    if (promoResult?.valid && promoResult.discount_pct) {
      return price * (1 - promoResult.discount_pct / 100);
    }
    return price;
  };

  const trialDays = selectedPlan?.trial_days ?? 0;

  const handleStartTrial = async () => {
    if (!selectedPlan) {
      showToast(
        isRTL ? "اختر خطة أولاً" : "Please select a plan first",
        "error",
      );
      return;
    }

    // If family not loaded yet, try refreshing
    let currentFamily = family;
    if (!currentFamily && user) {
      await refreshFamily();
      // Fetch directly from DB since React state won't update in this closure
      const { data } = await supabase
        .from("families")
        .select("*")
        .eq("auth_user_id", user.id)
        .single();
      currentFamily = data;
    }

    if (!currentFamily) {
      showToast(
        isRTL ? "حدث خطأ في تحميل الحساب" : "Failed to load account",
        "error",
      );
      return;
    }

    setPurchasing(true);

    try {
      const rawPrice = annual
        ? selectedPlan.price_annual
        : selectedPlan.price_monthly;
      const finalPrice = getDiscountedPrice(rawPrice);

      const result = await subscriptionService.purchase(
        {
          familyId: currentFamily.id,
          planId: selectedPlan.id,
          billingCycle: annual ? "annual" : "monthly",
          priceAmount: finalPrice,
          email: currentFamily.parent_email || user?.email || "",
          promoCode: promoResult?.valid ? promoCode.trim() : undefined,
        },
        "stripe",
      );

      if (result.cancelled) {
        setPurchasing(false);
        return;
      }

      if (result.success) {
        // Refresh family data to pick up new billing status
        await refreshFamily();
        showToast(
          trialDays > 0
            ? isRTL
              ? `تم الاشتراك بنجاح! ${trialDays} أيام مجانية`
              : `Subscribed! ${trialDays}-day free trial started`
            : isRTL
              ? "تم الاشتراك بنجاح!"
              : "Subscribed successfully!",
          "success",
        );
        // Short delay so user sees the toast
        setTimeout(() => router.push("/(auth)/add-kid"), 800);
      } else {
        showToast(
          result.error ||
            (isRTL ? "فشل الدفع، حاول مرة أخرى" : "Payment failed, try again"),
          "error",
        );
      }
    } catch (err: any) {
      console.error("Purchase error:", err);
      showToast(isRTL ? "حدث خطأ في الدفع" : "Payment error occurred", "error");
    } finally {
      setPurchasing(false);
    }
  };

  const features = isRTL ? FEATURES_AR : FEATURES_EN;

  return (
    <LinearGradient
      colors={["#FFFBF5", "#FEF3C7", "#FDF4E7"]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1 }}
    >
      <Toast toast={toast} />

      {/* Ambient blobs */}
      <View
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: "rgba(217,119,6,0.07)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 60,
          left: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: "rgba(13,148,136,0.06)",
        }}
      />

      <ScrollView
        contentContainerStyle={P.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable
          style={({ pressed }) => [P.backBtn, pressed && { opacity: 0.65 }]}
          onPress={() => router.back()}
        >
          <Text style={P.backBtnText}>{isRTL ? "→" : "←"}</Text>
        </Pressable>

        {/* Hero header */}
        <View style={P.header}>
          <View style={P.headerBadge}>
            <LinearGradient
              colors={["#FEF3C7", "#FDE68A"]}
              style={P.headerBadgeInner}
            >
              <Text style={{ fontSize: 34 }}>✨</Text>
            </LinearGradient>
          </View>
          <Text style={P.title}>
            {isRTL ? "اختر خطتك" : "Choose Your Plan"}
          </Text>
          {trialDays > 0 && (
            <View style={P.trialBanner}>
              <Text style={P.trialBannerText}>
                🎁{" "}
                {isRTL
                  ? `${trialDays} أيام مجاناً!`
                  : `${trialDays} days free trial!`}
              </Text>
            </View>
          )}
        </View>

        {/* Billing toggle */}
        <View style={P.toggleWrap}>
          <View style={P.toggleTrack}>
            <Pressable style={{ flex: 1 }} onPress={() => setAnnual(false)}>
              <View style={[P.togglePill, !annual && P.togglePillActive]}>
                {!annual && (
                  <LinearGradient
                    colors={[C.teal, "#0F766E"]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <Text style={[P.toggleText, !annual && P.toggleTextActive]}>
                  {isRTL ? "شهري" : "Monthly"}
                </Text>
              </View>
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => setAnnual(true)}>
              <View style={[P.togglePill, annual && P.togglePillActive]}>
                {annual && (
                  <LinearGradient
                    colors={[C.amber, C.amberLight]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <View style={{ alignItems: "center" }}>
                  <Text style={[P.toggleText, annual && P.toggleTextActive]}>
                    {isRTL ? "سنوي" : "Annual"}
                  </Text>
                  {!annual && (
                    <Text style={P.saveBadge}>
                      {isRTL ? "وفّر ٣٣٪" : "Save 33%"}
                    </Text>
                  )}
                  {annual && (
                    <Text
                      style={[P.saveBadge, { color: "rgba(255,255,255,0.85)" }]}
                    >
                      {isRTL ? "وفّر ٣٣٪" : "Save 33%"}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Plan cards */}
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={C.amber}
            style={{ marginVertical: 40 }}
          />
        ) : (
          <View style={{ gap: 10, marginBottom: 6 }}>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlanId === plan.id}
                onPress={() => setSelectedPlanId(plan.id)}
                annual={annual}
                isRTL={isRTL}
              />
            ))}
          </View>
        )}

        {/* Selected plan price summary */}
        {selectedPlan && (
          <View style={P.priceSummary}>
            <Text style={P.priceSummaryLabel}>
              {isRTL ? "الملخص:" : "Summary:"}
            </Text>
            <View style={P.priceSummaryRow}>
              <Text style={P.priceSummaryPlan}>
                {isRTL ? selectedPlan.name_ar : selectedPlan.name_en}
                {" · "}
                {annual
                  ? isRTL
                    ? "سنوي"
                    : "Annual"
                  : isRTL
                    ? "شهري"
                    : "Monthly"}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                {promoResult?.valid && promoResult.discount_pct ? (
                  <>
                    <Text style={P.priceOriginal}>
                      $
                      {annual
                        ? selectedPlan.price_annual
                        : selectedPlan.price_monthly}
                    </Text>
                    <Text style={P.priceFinal}>
                      $
                      {getDiscountedPrice(
                        annual
                          ? selectedPlan.price_annual
                          : selectedPlan.price_monthly,
                      ).toFixed(2)}
                    </Text>
                  </>
                ) : (
                  <Text style={P.priceFinal}>
                    $
                    {annual
                      ? selectedPlan.price_annual
                      : selectedPlan.price_monthly}
                    {annual ? (isRTL ? "/سنة" : "/yr") : isRTL ? "/شهر" : "/mo"}
                  </Text>
                )}
              </View>
            </View>
            <Text style={P.priceSummaryTrial}>
              {trialDays > 0
                ? isRTL
                  ? `لن يتم الخصم حتى انتهاء الفترة التجريبية (${trialDays} أيام)`
                  : `You won't be charged until your ${trialDays}-day trial ends`
                : isRTL
                  ? "سيتم الخصم فوراً عند الاشتراك"
                  : "You'll be charged immediately upon subscribing"}
            </Text>
          </View>
        )}

        {/* Promo code */}
        <View style={P.promoCard}>
          <View style={[P.cardAccentBar, { backgroundColor: C.violet }]} />
          <Text style={P.promoLabel}>
            {isRTL ? "🎟️ رمز الخصم" : "🎟️ Promo Code"}
          </Text>
          <View style={P.promoRow}>
            <View
              style={[
                P.promoFieldWrap,
                promoFocused && { borderColor: C.amber },
              ]}
            >
              <TextInput
                style={P.promoInput}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder={isRTL ? "أدخل الرمز..." : "Enter code..."}
                placeholderTextColor="#C4A98A"
                autoCapitalize="characters"
                onFocus={() => setPromoFocused(true)}
                onBlur={() => setPromoFocused(false)}
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                P.promoBtn,
                (promoLoading || pressed) && { opacity: 0.7 },
              ]}
              onPress={handlePromo}
              disabled={promoLoading}
            >
              <LinearGradient
                colors={[C.violet, "#9333EA"]}
                style={P.promoBtnGrad}
              >
                <Text style={P.promoBtnText}>
                  {promoLoading ? "..." : isRTL ? "تطبيق" : "Apply"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
          {promoResult?.valid && (
            <View style={P.promoSuccess}>
              <Text style={P.promoSuccessText}>
                🎉{" "}
                {isRTL
                  ? `خصم ${promoResult.discount_pct}%`
                  : `${promoResult.discount_pct}% off applied!`}
              </Text>
            </View>
          )}
        </View>

        {/* Features */}
        <View style={P.featuresCard}>
          <View style={P.cardAccentBar} />
          <Text style={P.featuresTitle}>
            {isRTL ? "✦ كل شيء متضمن" : "✦ Everything Included"}
          </Text>
          <View style={{ gap: 2 }}>
            {features.map((f, i) => (
              <FeatureRow key={i} icon={f.icon} text={f.text} delay={i * 60} />
            ))}
          </View>
        </View>

        {/* Payment methods info */}
        <View style={P.paymentInfo}>
          <Text style={P.paymentInfoText}>
            💳{" "}
            {isRTL
              ? "نقبل جميع البطاقات · Apple Pay · Google Pay"
              : "We accept all cards · Apple Pay · Google Pay"}
          </Text>
        </View>

        {/* CTA */}
        <Pressable
          onPress={handleStartTrial}
          disabled={purchasing || !selectedPlanId}
          style={({ pressed }) => [
            P.ctaWrap,
            pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
            purchasing && { opacity: 0.6 },
          ]}
        >
          <LinearGradient
            colors={[C.amber, "#B45309"]}
            style={P.ctaBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={P.btnGloss} />
            {purchasing ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <ActivityIndicator color="#fff" size="small" />
                <Text style={P.ctaText}>
                  {isRTL ? "جاري المعالجة..." : "Processing..."}
                </Text>
              </View>
            ) : (
              <Text style={P.ctaText}>
                {trialDays > 0
                  ? isRTL
                    ? `🚀 ابدأ ${trialDays} أيام مجاناً`
                    : `🚀 Start ${trialDays}-Day Free Trial`
                  : isRTL
                    ? "🚀 اشترك الآن"
                    : "🚀 Subscribe Now"}
              </Text>
            )}
          </LinearGradient>
        </Pressable>

        <View style={P.securityRow}>
          <Text style={P.securityText}>
            🔒{" "}
            {isRTL
              ? "دفع آمن عبر Stripe · إلغاء في أي وقت"
              : "Secure payment via Stripe · Cancel anytime"}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const P = StyleSheet.create({
  scroll: { padding: 22, paddingTop: 58 },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(217,119,6,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  backBtnText: { fontSize: 20, fontWeight: "900", color: C.amber },

  /* Header */
  header: { alignItems: "center", marginBottom: 22 },
  headerBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "rgba(217,119,6,0.22)",
    marginBottom: 12,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  headerBadgeInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1C1017",
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  trialBanner: {
    backgroundColor: "rgba(217,119,6,0.10)",
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.20)",
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  trialBannerText: { fontSize: 13, fontWeight: "800", color: C.amber },

  /* Toggle */
  toggleWrap: { marginBottom: 18 },
  toggleTrack: {
    flexDirection: "row",
    backgroundColor: "#F5EBD8",
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  togglePill: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  togglePillActive: {
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleText: { fontSize: 14, fontWeight: "700", color: "#A8A29E" },
  toggleTextActive: { color: "#FFFFFF", fontWeight: "900" },
  saveBadge: { fontSize: 10, fontWeight: "800", color: C.amber, marginTop: 2 },

  /* Plan card */
  planCard: {
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    position: "relative",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 4,
  },
  cardGlowBorder: {
    position: "absolute",
    inset: 0,
    borderRadius: 22,
    borderWidth: 2,
    zIndex: 1,
    pointerEvents: "none",
  },
  planCardInner: { padding: 18 },
  tagBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 10,
    borderWidth: 1.5,
  },
  tagText: { fontSize: 11, fontWeight: "800" },
  planName: {
    fontSize: 19,
    fontWeight: "900",
    color: "#1C1017",
    letterSpacing: -0.2,
  },
  planMeta: { fontSize: 12, fontWeight: "600", color: "#78716C", marginTop: 2 },
  planPrice: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  planCycle: { fontSize: 12, fontWeight: "600", color: "#78716C" },
  planSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  planSelectDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  planSelectText: { fontSize: 12, fontWeight: "800", color: C.amber },

  /* Price summary */
  priceSummary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.15)",
  },
  priceSummaryLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: C.inkMid,
    marginBottom: 8,
  },
  priceSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceSummaryPlan: {
    fontSize: 14,
    fontWeight: "700",
    color: C.ink,
    flex: 1,
  },
  priceOriginal: {
    fontSize: 14,
    fontWeight: "600",
    color: "#A8A29E",
    textDecorationLine: "line-through",
  },
  priceFinal: {
    fontSize: 20,
    fontWeight: "900",
    color: C.amber,
  },
  priceSummaryTrial: {
    fontSize: 11,
    fontWeight: "600",
    color: C.inkFaint,
    marginTop: 8,
    textAlign: "center",
  },

  /* Promo card */
  promoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.07)",
    overflow: "hidden",
  },
  cardAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.amber,
  },
  promoLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#44403C",
    marginBottom: 10,
    marginTop: 4,
  },
  promoRow: { flexDirection: "row", gap: 8 },
  promoFieldWrap: {
    flex: 1,
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(217,119,6,0.14)",
    overflow: "hidden",
  },
  promoInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#1C1017",
    fontSize: 14,
    fontWeight: "700",
  },
  promoBtn: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: C.violet,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  promoBtnGrad: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  promoBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  promoSuccess: {
    backgroundColor: "rgba(5,150,105,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(5,150,105,0.20)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  promoSuccessText: { fontSize: 13, fontWeight: "800", color: C.green },

  /* Features */
  featuresCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.07)",
    overflow: "hidden",
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#44403C",
    marginBottom: 14,
    marginTop: 6,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(217,119,6,0.07)",
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(217,119,6,0.14)",
  },
  featureText: { fontSize: 14, fontWeight: "700", color: "#1C1017", flex: 1 },

  /* Payment info */
  paymentInfo: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 4,
  },
  paymentInfoText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.inkFaint,
  },

  /* CTA */
  ctaWrap: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtn: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    overflow: "hidden",
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  btnGloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  /* Security */
  securityRow: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  securityText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#A8A29E",
  },
});
