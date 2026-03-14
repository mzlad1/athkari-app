import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * GET /functions/v1/analytics-aggregate
 * Returns dashboard KPIs for admin.
 * Calculates MRR, active users, retention, funnel metrics.
 */
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Family counts by status
  const { data: families } = await supabase
    .from("families")
    .select("id, billing_status, plan_id, created_at, plans!inner(price_monthly, price_annual)");

  const totalFamilies = families?.length || 0;
  const active = families?.filter(f => f.billing_status === "active") || [];
  const trial = families?.filter(f => f.billing_status === "trial") || [];
  const churned = families?.filter(f => f.billing_status === "churned") || [];

  // 2. MRR calculation
  const mrr = active.reduce((sum, f) => {
    return sum + (f.plans?.price_monthly || 0);
  }, 0);

  // 3. Kid stats
  const { count: totalKids } = await supabase
    .from("kids")
    .select("*", { count: "exact", head: true });

  // 4. Active kids today (completed at least 1 dhikr)
  const today = new Date().toISOString().split("T")[0];
  const { data: todayLogs } = await supabase
    .from("wird_logs")
    .select("kid_id")
    .eq("log_date", today);

  const activeToday = new Set(todayLogs?.map(l => l.kid_id)).size;

  // 5. Trial conversion rate (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentFamilies = families?.filter(f => 
    new Date(f.created_at) > thirtyDaysAgo
  ) || [];

  const converted = recentFamilies.filter(f => f.billing_status === "active").length;
  const trialConversion = recentFamilies.length > 0 
    ? Math.round((converted / recentFamilies.length) * 100) 
    : 0;

  return new Response(JSON.stringify({
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    total_families: totalFamilies,
    active_subscribers: active.length,
    trial_users: trial.length,
    churned_users: churned.length,
    total_kids: totalKids || 0,
    active_kids_today: activeToday,
    trial_conversion_rate: trialConversion,
    churn_rate: totalFamilies > 0 ? Math.round((churned.length / totalFamilies) * 100) : 0,
  }));
});
