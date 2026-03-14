import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import { usePlans } from "@/hooks/usePlans";
import { subscriptionService } from "@/services/subscriptions";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui";

const C = {
  violet: "#7C3AED",
  violetSoft: "#EDE9FE",
  orange: "#F97316",
  orangeSoft: "#FFF7ED",
  green: "#10B981",
  greenSoft: "#ECFDF5",
  amber: "#D97706",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  ink: "#1C1917",
  inkMid: "#44403C",
  inkFaint: "#78716C",
  white: "#FFFFFF",
  cream: "#FFF7ED",
};

const PLAN_ACCENT: Record<number, string> = {
  0: C.violet,
  1: C.orange,
  2: C.green,
};
const PLAN_GRADIENT: Record<number, [string, string]> = {
  0: ["#EDE9FE", "#DDD6FE"],
  1: ["#FFF7ED", "#FED7AA"],
  2: ["#ECFDF5", "#A7F3D0"],
};
const PLAN_EMOJI: string[] = ["🌱", "⭐", "🏆"];

type Tab = "current" | "change";

export default function PlansScreen() {
  const { lang } = useLang();
  const isRTL = lang === "ar";
  const { family, refreshFamily } = useAuth();
  const { plans, loading } = usePlans();
  const { toast, showToast } = useToast();

  const [tab, setTab] = useState<Tab>("current");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [subStatus, setSubStatus] = useState<{
    isActive: boolean;
    status: string;
    planId: number | null;
    billingCycle: string;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
  } | null>(null);

  // Load subscription status
  useEffect(() => {
    if (family?.id) {
      subscriptionService.checkSubscriptionDB(family.id).then(setSubStatus);
    }
  }, [family?.id]);

  // Init selected plan from current
  useEffect(() => {
    if (family?.plan_id) {
      setSelectedPlanId(family.plan_id);
      setIsAnnual(family.billing_cycle === "annual");
    }
  }, [family]);

  const currentPlan = plans.find((p) => p.id === family?.plan_id);
  const billingStatus = subStatus?.status || family?.billing_status || "trial";
  const isActive = billingStatus === "active" || billingStatus === "trial";
  const isTrial = billingStatus === "trial";

  const statusLabel = {
    trial: isRTL ? "فترة تجريبية" : "Trial",
    active: isRTL ? "نشط" : "Active",
    past_due: isRTL ? "متأخر" : "Past Due",
    churned: isRTL ? "منتهي" : "Expired",
    suspended: isRTL ? "معلق" : "Suspended",
  }[billingStatus] || billingStatus;

  const statusColor = {
    trial: C.amber,
    active: C.green,
    past_due: C.orange,
    churned: C.red,
    suspended: C.red,
  }[billingStatus] || C.inkFaint;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleChangePlan = async () => {
    if (!family?.id || !selectedPlanId) return;

    // Same plan, no change needed
    if (
      selectedPlanId === family.plan_id &&
      (isAnnual ? "annual" : "monthly") === family.billing_cycle
    ) {
      showToast(
        isRTL ? "أنت بالفعل على هذه الخطة" : "You're already on this plan",
        "error",
      );
      return;
    }

    // If no active subscription, need to purchase first
    if (!family.stripe_subscription_id && billingStatus !== "active") {
      const selectedPlan = plans.find((p) => p.id === selectedPlanId);
      if (!selectedPlan) return;

      setProcessing(true);
      try {
        const price = isAnnual
          ? selectedPlan.price_annual
          : selectedPlan.price_monthly;

        const result = await subscriptionService.purchase(
          {
            familyId: family.id,
            planId: selectedPlanId,
            billingCycle: isAnnual ? "annual" : "monthly",
            priceAmount: price,
            email: family.parent_email || "",
          },
          "stripe",
        );

        if (result.cancelled) {
          setProcessing(false);
          return;
        }

        if (result.success) {
          await refreshFamily();
          const status = await subscriptionService.checkSubscriptionDB(family.id);
          setSubStatus(status);
          setTab("current");
          showToast(
            isRTL ? "تم الاشتراك بنجاح!" : "Subscribed successfully!",
            "success",
          );
        } else {
          showToast(
            result.error ||
              (isRTL ? "فشلت العملية" : "Operation failed"),
            "error",
          );
        }
      } catch (err: any) {
        showToast(err.message || "Error", "error");
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Change existing subscription
    setProcessing(true);
    try {
      const ok = await subscriptionService.changePlan(
        family.id,
        selectedPlanId,
        isAnnual ? "annual" : "monthly",
      );

      if (ok) {
        await refreshFamily();
        const status = await subscriptionService.checkSubscriptionDB(family.id);
        setSubStatus(status);
        setTab("current");
        showToast(
          isRTL ? "تم تحديث الخطة بنجاح!" : "Plan updated successfully!",
          "success",
        );
      } else {
        showToast(
          isRTL ? "فشل تحديث الخطة" : "Failed to update plan",
          "error",
        );
      }
    } catch (err: any) {
      showToast(err.message || "Error", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      isRTL ? "إلغاء الاشتراك" : "Cancel Subscription",
      isRTL
        ? "هل أنت متأكد؟ ستبقى لديك صلاحية حتى نهاية الفترة الحالية."
        : "Are you sure? You'll keep access until the end of your current period.",
      [
        { text: isRTL ? "لا" : "No", style: "cancel" },
        {
          text: isRTL ? "نعم، إلغاء" : "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            if (!family?.id) return;
            setProcessing(true);
            try {
              const ok = await subscriptionService.cancelSubscription(family.id);
              if (ok) {
                await refreshFamily();
                const status = await subscriptionService.checkSubscriptionDB(
                  family.id,
                );
                setSubStatus(status);
                showToast(
                  isRTL
                    ? "تم إلغاء الاشتراك — سيبقى نشطاً حتى نهاية الفترة"
                    : "Subscription cancelled — stays active until period end",
                  "success",
                );
              } else {
                showToast(
                  isRTL ? "فشل إلغاء الاشتراك" : "Failed to cancel",
                  "error",
                );
              }
            } catch {
              showToast(isRTL ? "حدث خطأ" : "Error occurred", "error");
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleRestore = async () => {
    setProcessing(true);
    try {
      const restored = await subscriptionService.restore();
      if (restored) {
        await refreshFamily();
        showToast(
          isRTL ? "تم استعادة المشتريات!" : "Purchases restored!",
          "success",
        );
      } else {
        showToast(
          isRTL ? "لا توجد مشتريات سابقة" : "No previous purchases found",
          "error",
        );
      }
    } catch {
      showToast(isRTL ? "فشلت الاستعادة" : "Restore failed", "error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <Toast toast={toast} />

      {/* ━━━ HEADER ━━━ */}
      <LinearGradient
        colors={["#7C3AED", "#9333EA", "#C026D3"]}
        style={S.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={S.headerWatermark}>💎</Text>
        <Text style={S.headerEmoji}>💳</Text>
        <Text style={S.headerTitle}>
          {isRTL ? "الاشتراك" : "Subscription"}
        </Text>
        <Text style={S.headerSub}>
          {isRTL ? "إدارة خطتك والدفع" : "Manage your plan & billing"}
        </Text>

        {/* Tab toggle */}
        <View style={S.tabRow}>
          <Pressable style={{ flex: 1 }} onPress={() => setTab("current")}>
            {tab === "current" ? (
              <LinearGradient
                colors={[C.orange, "#FB923C"]}
                style={S.tabActive}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={S.tabActiveText}>
                  {isRTL ? "خطتي" : "My Plan"}
                </Text>
              </LinearGradient>
            ) : (
              <View style={S.tabInactive}>
                <Text style={S.tabInactiveText}>
                  {isRTL ? "خطتي" : "My Plan"}
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable style={{ flex: 1 }} onPress={() => setTab("change")}>
            {tab === "change" ? (
              <LinearGradient
                colors={[C.orange, "#FB923C"]}
                style={S.tabActive}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={S.tabActiveText}>
                  {isRTL ? "تغيير" : "Change"}
                </Text>
              </LinearGradient>
            ) : (
              <View style={S.tabInactive}>
                <Text style={S.tabInactiveText}>
                  {isRTL ? "تغيير" : "Change"}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={S.loadingWrap}>
            <ActivityIndicator size="large" color={C.violet} />
          </View>
        ) : tab === "current" ? (
          /* ──────────────────────── CURRENT PLAN TAB ──────────────────────── */
          <>
            {/* Status card */}
            <View style={S.statusCard}>
              <View style={S.statusRow}>
                <View
                  style={[S.statusDot, { backgroundColor: statusColor }]}
                />
                <Text style={[S.statusLabel, { color: statusColor }]}>
                  {statusLabel}
                </Text>
              </View>

              {currentPlan ? (
                <View style={S.currentPlanInfo}>
                  <Text style={S.currentPlanEmoji}>
                    {PLAN_EMOJI[
                      plans.findIndex((p) => p.id === currentPlan.id) % 3
                    ] || "⭐"}
                  </Text>
                  <Text style={S.currentPlanName}>
                    {isRTL ? currentPlan.name_ar : currentPlan.name_en}
                  </Text>
                  <Text style={S.currentPlanPrice}>
                    $
                    {family?.billing_cycle === "annual"
                      ? currentPlan.price_annual
                      : currentPlan.price_monthly}
                    {family?.billing_cycle === "annual"
                      ? isRTL
                        ? "/سنة"
                        : "/year"
                      : isRTL
                        ? "/شهر"
                        : "/month"}
                  </Text>
                  <Text style={S.currentPlanKids}>
                    {currentPlan.max_kids}{" "}
                    {isRTL ? "أطفال كحد أقصى" : "kids max"}
                  </Text>
                </View>
              ) : (
                <View style={S.currentPlanInfo}>
                  <Text style={S.currentPlanEmoji}>🆓</Text>
                  <Text style={S.currentPlanName}>
                    {isRTL ? "بدون خطة" : "No Plan"}
                  </Text>
                  <Text style={S.currentPlanPrice}>
                    {isRTL ? "مجاني" : "Free"}
                  </Text>
                </View>
              )}
            </View>

            {/* Billing details */}
            <View style={S.detailsCard}>
              <Text style={S.detailsTitle}>
                {isRTL ? "تفاصيل الفواتير" : "Billing Details"}
              </Text>

              <View style={S.detailRow}>
                <Text style={S.detailLabel}>
                  {isRTL ? "الدورة" : "Cycle"}
                </Text>
                <Text style={S.detailValue}>
                  {family?.billing_cycle === "annual"
                    ? isRTL
                      ? "سنوي"
                      : "Annual"
                    : isRTL
                      ? "شهري"
                      : "Monthly"}
                </Text>
              </View>

              {isTrial && (
                <View style={S.detailRow}>
                  <Text style={S.detailLabel}>
                    {isRTL ? "نهاية التجربة" : "Trial Ends"}
                  </Text>
                  <Text style={[S.detailValue, { color: C.amber }]}>
                    {formatDate(
                      subStatus?.trialEnd || family?.trial_end,
                    )}
                  </Text>
                </View>
              )}

              <View style={S.detailRow}>
                <Text style={S.detailLabel}>
                  {isRTL ? "الفاتورة القادمة" : "Next Billing"}
                </Text>
                <Text style={S.detailValue}>
                  {formatDate(
                    subStatus?.currentPeriodEnd ||
                      family?.current_period_end,
                  )}
                </Text>
              </View>

              <View style={[S.detailRow, { borderBottomWidth: 0 }]}>
                <Text style={S.detailLabel}>
                  {isRTL ? "طريقة الدفع" : "Payment"}
                </Text>
                <Text style={S.detailValue}>
                  {family?.stripe_customer_id
                    ? "💳 Stripe"
                    : family?.rc_subscriber_id
                      ? "📱 App Store / Play Store"
                      : "—"}
                </Text>
              </View>
            </View>

            {/* Features list */}
            {currentPlan && (
              <View style={S.featuresCard}>
                <Text style={S.featuresTitle}>
                  {isRTL ? "✅ مميزات خطتك:" : "✅ Your Plan Includes:"}
                </Text>
                {(currentPlan.features || []).map(
                  (f: string, i: number) => (
                    <View key={i} style={S.featureRow}>
                      <Text style={S.featureCheck}>✓</Text>
                      <Text style={S.featureText}>{f}</Text>
                    </View>
                  ),
                )}
              </View>
            )}

            {/* Action buttons */}
            <View style={{ gap: 10, marginTop: 8 }}>
              {isActive && (
                <Pressable
                  style={({ pressed }) => [
                    S.actionBtn,
                    { backgroundColor: C.violetSoft },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => setTab("change")}
                >
                  <Text style={[S.actionBtnText, { color: C.violet }]}>
                    {isRTL ? "تغيير الخطة ←" : "Change Plan →"}
                  </Text>
                </Pressable>
              )}

              {!isActive && (
                <Pressable
                  style={({ pressed }) => [
                    S.upgradeBtn,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => setTab("change")}
                >
                  <LinearGradient
                    colors={[C.orange, "#FB923C"]}
                    style={S.upgradeBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={S.upgradeBtnText}>
                      🚀 {isRTL ? "ترقية الآن" : "Upgrade Now"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  S.actionBtn,
                  { backgroundColor: "#F5F5F4" },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={handleRestore}
                disabled={processing}
              >
                <Text style={[S.actionBtnText, { color: C.inkMid }]}>
                  {processing
                    ? "..."
                    : isRTL
                      ? "🔄 استعادة المشتريات"
                      : "🔄 Restore Purchases"}
                </Text>
              </Pressable>

              {isActive && family?.stripe_subscription_id && (
                <Pressable
                  style={({ pressed }) => [
                    S.actionBtn,
                    { backgroundColor: C.redSoft },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={handleCancel}
                  disabled={processing}
                >
                  <Text style={[S.actionBtnText, { color: C.red }]}>
                    {isRTL ? "إلغاء الاشتراك" : "Cancel Subscription"}
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        ) : (
          /* ──────────────────────── CHANGE PLAN TAB ──────────────────────── */
          <>
            {/* Billing toggle */}
            <View style={S.toggleRow}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => setIsAnnual(false)}
              >
                {!isAnnual ? (
                  <LinearGradient
                    colors={[C.orange, "#FB923C"]}
                    style={S.toggleBtnActive}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={S.toggleTextActive}>
                      📅 {isRTL ? "شهري" : "Monthly"}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={S.toggleBtn}>
                    <Text style={S.toggleText}>
                      📅 {isRTL ? "شهري" : "Monthly"}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                style={{ flex: 1 }}
                onPress={() => setIsAnnual(true)}
              >
                {isAnnual ? (
                  <LinearGradient
                    colors={[C.orange, "#FB923C"]}
                    style={S.toggleBtnActive}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={S.toggleTextActive}>
                      🎁 {isRTL ? "سنوي" : "Annual"}
                    </Text>
                    <View style={S.saveBadge}>
                      <Text style={S.saveBadgeText}>-33%</Text>
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={S.toggleBtn}>
                    <Text style={S.toggleText}>
                      🎁 {isRTL ? "سنوي" : "Annual"}
                    </Text>
                    <View
                      style={[
                        S.saveBadge,
                        { backgroundColor: "rgba(16,185,129,0.2)" },
                      ]}
                    >
                      <Text style={[S.saveBadgeText, { color: C.green }]}>
                        -33%
                      </Text>
                    </View>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Plan cards */}
            {plans.map((plan, idx) => {
              const price = isAnnual
                ? Number(plan.price_annual)
                : Number(plan.price_monthly);
              const isSelected = selectedPlanId === plan.id;
              const isCurrent = plan.id === family?.plan_id;
              const period = isAnnual
                ? isRTL
                  ? "/سنة"
                  : "/year"
                : isRTL
                  ? "/شهر"
                  : "/mo";
              const label = isRTL
                ? plan.name_ar || plan.name_en
                : plan.name_en || plan.name_ar;
              const badge =
                plan.tag === "popular"
                  ? isRTL
                    ? "🔥 الأكثر شعبية"
                    : "🔥 Most Popular"
                  : plan.tag === "best_value"
                    ? isRTL
                      ? "💎 الأفضل قيمة"
                      : "💎 Best Value"
                    : null;

              const gradKey = idx % 3;
              const accent = PLAN_ACCENT[gradKey] || C.violet;
              const gradColors = PLAN_GRADIENT[gradKey] || ["#EDE9FE", "#DDD6FE"];
              const emoji = PLAN_EMOJI[idx % 3];

              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setSelectedPlanId(plan.id)}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={gradColors}
                      style={[
                        S.planCard,
                        {
                          borderWidth: 2.5,
                          borderColor: accent,
                          shadowColor: accent,
                          shadowOpacity: 0.22,
                        },
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <PlanCardContent
                        badge={badge}
                        label={label}
                        plan={plan}
                        price={price}
                        period={period}
                        accent={accent}
                        emoji={emoji}
                        isSelected
                        isCurrent={isCurrent}
                        isRTL={isRTL}
                      />
                    </LinearGradient>
                  ) : (
                    <View
                      style={[
                        S.planCard,
                        {
                          borderColor: isCurrent
                            ? accent + "66"
                            : "#F3F4F6",
                        },
                      ]}
                    >
                      <PlanCardContent
                        badge={badge}
                        label={label}
                        plan={plan}
                        price={price}
                        period={period}
                        accent={accent}
                        emoji={emoji}
                        isSelected={false}
                        isCurrent={isCurrent}
                        isRTL={isRTL}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}

            {/* Confirm change button */}
            <Pressable
              style={({ pressed }) => [
                S.confirmBtn,
                pressed && { opacity: 0.8 },
                processing && { opacity: 0.5 },
              ]}
              onPress={handleChangePlan}
              disabled={processing || !selectedPlanId}
            >
              <LinearGradient
                colors={[C.orange, "#FB923C"]}
                style={S.confirmBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {processing ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={S.confirmBtnText}>
                      {isRTL ? "جاري المعالجة..." : "Processing..."}
                    </Text>
                  </View>
                ) : (
                  <Text style={S.confirmBtnText}>
                    {family?.stripe_subscription_id
                      ? isRTL
                        ? "تأكيد تغيير الخطة"
                        : "Confirm Plan Change"
                      : isRTL
                        ? "🚀 اشترك الآن"
                        : "🚀 Subscribe Now"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            <Text style={S.disclaimer}>
              {isRTL
                ? "🔒 دفع آمن عبر Stripe · إلغاء في أي وقت"
                : "🔒 Secure payment via Stripe · Cancel anytime"}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ── Plan card inner content ── */
function PlanCardContent({
  badge,
  label,
  plan,
  price,
  period,
  accent,
  emoji,
  isSelected,
  isCurrent,
  isRTL,
}: {
  badge: string | null;
  label: string;
  plan: any;
  price: number;
  period: string;
  accent: string;
  emoji: string;
  isSelected: boolean;
  isCurrent: boolean;
  isRTL: boolean;
}) {
  return (
    <>
      <Text style={[S.planWatermark, { color: accent }]}>{emoji}</Text>

      {badge && (
        <View style={[S.planBadge, { backgroundColor: accent }]}>
          <Text style={S.planBadgeText}>{badge}</Text>
        </View>
      )}

      {isCurrent && (
        <View style={S.currentBadge}>
          <Text style={S.currentBadgeText}>
            {isRTL ? "الحالية" : "Current"}
          </Text>
        </View>
      )}

      {isSelected && (
        <View style={[S.checkCircle, { backgroundColor: accent }]}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>
            ✓
          </Text>
        </View>
      )}

      <View style={S.planHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={S.planEmojiBig}>{emoji}</Text>
          <Text style={[S.planLabel, isSelected && { color: accent }]}>
            {label}
          </Text>
          <View style={S.kidsPillRow}>
            {Array.from({ length: Math.min(plan.max_kids || 1, 5) }).map(
              (_, i) => (
                <View
                  key={i}
                  style={[S.kidsPill, { backgroundColor: `${accent}20` }]}
                >
                  <Text style={{ fontSize: 14 }}>👶</Text>
                </View>
              ),
            )}
            {(plan.max_kids || 0) > 5 && (
              <View
                style={[S.kidsPill, { backgroundColor: `${accent}20` }]}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "800", color: accent }}
                >
                  +{(plan.max_kids || 0) - 5}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={S.pricePill}>
          <Text style={[S.planPrice, { color: accent }]}>
            ${price.toFixed(2)}
          </Text>
          <Text style={[S.planPeriod, { color: `${accent}99` }]}>
            {period}
          </Text>
        </View>
      </View>
    </>
  );
}

const S = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
    position: "relative",
  },
  headerWatermark: {
    position: "absolute",
    fontSize: 130,
    opacity: 0.07,
    right: -10,
    top: 10,
  },
  headerEmoji: { fontSize: 40, marginBottom: 6 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#fff" },
  headerSub: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    marginTop: 4,
    marginBottom: 16,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  tabActive: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabActiveText: { fontSize: 14, fontWeight: "900", color: "#fff" },
  tabInactive: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabInactiveText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
  },

  // Loading
  loadingWrap: { alignItems: "center", paddingVertical: 40 },

  // Status card
  statusCard: {
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  currentPlanInfo: {
    alignItems: "center",
    gap: 4,
  },
  currentPlanEmoji: { fontSize: 44 },
  currentPlanName: {
    fontSize: 22,
    fontWeight: "900",
    color: C.ink,
    marginTop: 4,
  },
  currentPlanPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: C.orange,
  },
  currentPlanKids: {
    fontSize: 13,
    fontWeight: "700",
    color: C.inkFaint,
    marginTop: 2,
  },

  // Details card
  detailsCard: {
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: C.ink,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F4",
  },
  detailLabel: { fontSize: 13, fontWeight: "700", color: C.inkFaint },
  detailValue: { fontSize: 14, fontWeight: "800", color: C.ink },

  // Features card
  featuresCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },
  featuresTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#065F46",
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  featureCheck: { fontSize: 14, color: C.green, fontWeight: "900" },
  featureText: { fontSize: 13, fontWeight: "700", color: "#065F46", flex: 1 },

  // Action buttons
  actionBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionBtnText: { fontSize: 14, fontWeight: "800" },
  upgradeBtn: { borderRadius: 20, overflow: "hidden" },
  upgradeBtnGrad: {
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  upgradeBtnText: { fontSize: 16, fontWeight: "900", color: "#fff" },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#F5EBD8",
    borderRadius: 16,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  toggleBtnActive: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  toggleText: { fontSize: 13, fontWeight: "700", color: C.inkFaint },
  toggleTextActive: { fontSize: 13, fontWeight: "900", color: "#fff" },
  saveBadge: {
    backgroundColor: C.green,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  saveBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },

  // Plan card
  planCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    position: "relative",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 5,
  },
  planWatermark: {
    position: "absolute",
    fontSize: 90,
    opacity: 0.08,
    right: -5,
    bottom: -10,
  },
  planBadge: {
    position: "absolute",
    top: -1,
    right: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  planBadgeText: { fontSize: 11, fontWeight: "900", color: "#fff" },
  currentBadge: {
    position: "absolute",
    top: -1,
    left: 16,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: C.green,
  },
  currentBadgeText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  checkCircle: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  planEmojiBig: { fontSize: 28, marginBottom: 4 },
  planLabel: {
    fontSize: 17,
    fontWeight: "900",
    color: C.ink,
    marginBottom: 8,
  },
  kidsPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  kidsPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pricePill: { alignItems: "flex-end" },
  planPrice: { fontSize: 28, fontWeight: "900" },
  planPeriod: { fontSize: 12, fontWeight: "700", marginTop: 2 },

  // Confirm button
  confirmBtn: {
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 8,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  confirmBtnGrad: {
    paddingVertical: 18,
    borderRadius: 24,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontSize: 17, fontWeight: "900" },

  disclaimer: {
    fontSize: 12,
    fontWeight: "700",
    color: C.inkFaint,
    textAlign: "center",
    marginTop: 12,
  },
});
