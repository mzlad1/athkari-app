import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getLocalTime(tz: string) {
  const now = new Date();
  const parts: Record<string, string> = {};
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  for (const p of fmt.formatToParts(now)) {
    parts[p.type] = p.value;
  }
  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = dayMap[parts.weekday] ?? now.getUTCDay();
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  return { hour, minute, dayOfWeek, dateStr };
}

function matchesFrequency(freq: string, dow: number): boolean {
  switch (freq) {
    case "weekdays":
      return dow >= 0 && dow <= 4;
    case "weekends":
      return dow === 5 || dow === 6;
    case "fri":
      return dow === 5;
    case "sat_sun":
      return dow === 0 || dow === 6;
    case "daily":
      return true;
    default:
      return true;
  }
}

async function sendPushDirect(
  supabase: any,
  tpl: any,
  matchedTz: string,
  tzList: string[],
): Promise<{ sent: number; error?: string }> {
  try {
    // Get active device tokens filtered by user timezone
    let query = supabase
      .from("device_tokens")
      .select("token, timezone")
      .eq("is_active", true);

    // Filter tokens to only users whose saved timezone matches the template's timezones
    if (tzList.length > 0) {
      query = query.in("timezone", tzList);
    }

    const { data: tokens, error: tokErr } = await query;

    if (tokErr) return { sent: 0, error: tokErr.message };
    if (!tokens?.length) return { sent: 0, error: "no_tokens_for_tz" };

    const seen = new Set<string>();
    const uniqueTokens = tokens.filter((t: any) => {
      if (seen.has(t.token)) return false;
      seen.add(t.token);
      return true;
    });

    const messages = uniqueTokens.map((t: any) => ({
      to: t.token,
      title: tpl.title_ar || tpl.title_en,
      body: tpl.body_ar || tpl.body_en,
      data: { template_id: tpl.id, scheduled: true, timezone: matchedTz },
      sound: "default",
    }));

    let totalSent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (res.ok) totalSent += batch.length;
    }

    // Log to notifications table
    await supabase.from("notifications").insert({
      template_id: tpl.id,
      title_en: tpl.title_en,
      title_ar: tpl.title_ar,
      body_en: tpl.body_en,
      body_ar: tpl.body_ar,
      target_segment: { segment: tpl.target_segment, timezone: matchedTz },
      sent_at: new Date().toISOString(),
      stats: { sent: totalSent },
    });

    return { sent: totalSent };
  } catch (e) {
    return { sent: 0, error: String(e) };
  }
}

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();

  const { data: templates, error } = await supabase
    .from("notification_templates")
    .select("*")
    .eq("is_active", true)
    .not("schedule", "is", null)
    .neq("schedule", "");

  if (error || !templates?.length) {
    return new Response(
      JSON.stringify({ checked: 0, sent: 0, error: error?.message }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  let sentCount = 0;
  const debug: any[] = [];

  for (const tpl of templates) {
    const tplDebug: any = {
      id: tpl.id,
      name: tpl.name,
      schedule: tpl.schedule,
    };

    const parts = (tpl.schedule || "").split("|");
    if (parts.length < 2) {
      tplDebug.reason = "bad_format (need HH:MM|freq|tz)";
      debug.push(tplDebug);
      continue;
    }

    const [timeStr, frequency] = parts;
    const tzRaw = parts[2] || "Asia/Riyadh";
    const tzList = tzRaw.split(",").filter(Boolean);

    const [hourStr, minStr] = timeStr.split(":");
    const schedHour = parseInt(hourStr, 10);
    const schedMin = parseInt(minStr, 10);
    if (isNaN(schedHour) || isNaN(schedMin)) {
      tplDebug.reason = "bad_time";
      debug.push(tplDebug);
      continue;
    }

    tplDebug.schedTime = `${schedHour}:${String(schedMin).padStart(2, "0")}`;
    tplDebug.frequency = frequency;
    tplDebug.timezones = tzList;

    const tzChecks: any[] = [];

    // Each timezone fires independently
    for (const tz of tzList) {
      const tzCheck: any = { tz };
      try {
        const local = getLocalTime(tz);
        const windowStart = Math.floor(local.minute / 15) * 15;
        const windowEnd = windowStart + 14;
        tzCheck.localTime = `${local.hour}:${String(local.minute).padStart(2, "0")}`;
        tzCheck.window = `${windowStart}-${windowEnd}`;

        if (schedHour !== local.hour) {
          tzCheck.skip = `hour: sched=${schedHour} vs local=${local.hour}`;
          tzChecks.push(tzCheck);
          continue;
        }
        if (schedMin < windowStart || schedMin > windowEnd) {
          tzCheck.skip = `min: sched=${schedMin} not in ${windowStart}-${windowEnd}`;
          tzChecks.push(tzCheck);
          continue;
        }
        if (!matchesFrequency(frequency, local.dayOfWeek)) {
          tzCheck.skip = `freq: ${frequency} vs day=${local.dayOfWeek}`;
          tzChecks.push(tzCheck);
          continue;
        }

        // Check per-timezone dedup log instead of last_sent_at
        const { data: alreadySent } = await supabase
          .from("notification_template_tz_log")
          .select("id")
          .eq("template_id", tpl.id)
          .eq("timezone", tz)
          .eq("sent_date", local.dateStr)
          .limit(1)
          .maybeSingle();

        if (alreadySent) {
          tzCheck.skip = "already_sent_today (tz_log)";
          tzChecks.push(tzCheck);
          continue;
        }

        // This tz matches — send only to devices in this timezone
        tzCheck.skip = "MATCH";
        tzChecks.push(tzCheck);

        const result = await sendPushDirect(supabase, tpl, tz, [tz]);

        if (result.sent > 0 || !result.error) {
          // Log per-tz send for dedup
          await supabase.from("notification_template_tz_log").insert({
            template_id: tpl.id,
            timezone: tz,
            sent_date: local.dateStr,
          });
          // Update last_sent_at for admin dashboard display only
          await supabase
            .from("notification_templates")
            .update({ last_sent_at: now.toISOString() })
            .eq("id", tpl.id);
          sentCount++;
          tzCheck.result = `sent_${result.sent}`;
        } else {
          tzCheck.result = `send_failed: ${result.error}`;
        }
      } catch (e) {
        tzCheck.skip = `error: ${e}`;
        tzChecks.push(tzCheck);
      }
    }

    tplDebug.tzChecks = tzChecks;
    debug.push(tplDebug);
  }

  return new Response(
    JSON.stringify({
      checked: templates.length,
      sent: sentCount,
      utcTime: now.toISOString(),
      debug,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
