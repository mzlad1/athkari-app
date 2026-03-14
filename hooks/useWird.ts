import { useState, useEffect, useRef } from "react";
import { supabase } from "@/services/supabase";
import type { Dhikr } from "@/types/database";

interface WirdItem extends Dhikr {
  is_completed: boolean;
}

function getRewardStarsByAge(ageGroup: string): number {
  switch (ageGroup) {
    case "4-6":
      return 30;
    case "7-9":
      return 50;
    case "10-12":
      return 70;
    case "13+":
      return 100;
    default:
      return 50;
  }
}

export function useWird(kidId: string | null) {
  const [items, setItems] = useState<WirdItem[]>([]);
  const [template, setTemplate] = useState<any>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refs to avoid stale closures and prevent race conditions
  const cachedTemplateId = useRef<number | null>(null);
  const cachedAdhkarIds = useRef<number[]>([]);
  const isPendingWrite = useRef(false);

  useEffect(() => {
    if (!kidId) return;
    cachedTemplateId.current = null; // reset cache on kid change
    fetchWird();

    // Real-time: when admin changes a wird template, invalidate cache and re-fetch
    const sub = supabase
      .channel("wird-templates-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wird_templates" },
        () => {
          cachedTemplateId.current = null;
          cachedAdhkarIds.current = [];
          fetchWird();
        },
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [kidId]);

  async function fetchWird() {
    // Don't overwrite optimistic updates while a write is in-flight
    if (isPendingWrite.current) return;

    const today = new Date().toISOString().split("T")[0];

    // Fast-path: if adhkar ids are already cached (template or custom), only re-fetch today's log
    if (cachedAdhkarIds.current.length > 0) {
      const { data: logRes } = await supabase
        .from("wird_logs")
        .select("completed_items, is_complete")
        .eq("kid_id", kidId)
        .eq("log_date", today)
        .single();

      if (isPendingWrite.current) return; // write started while we were fetching

      const completedIds = new Set(
        (logRes?.completed_items || []).map((i: any) => i.adhkar_id),
      );
      setItems((prev) =>
        prev.map((a) => ({ ...a, is_completed: completedIds.has(a.id) })),
      );
      setIsComplete(logRes?.is_complete || false);
      return;
    }

    // Full initial load
    setLoading(true);

    // Step 1: Get kid info (template or custom adhkar ids)
    const { data: kid } = await supabase
      .from("kids")
      .select("wird_template_id, age_group, custom_adhkar_ids")
      .eq("id", kidId)
      .single();

    const customIds = Array.isArray(kid?.custom_adhkar_ids)
      ? (kid.custom_adhkar_ids as number[]).filter((n) => Number.isInteger(n))
      : [];

    let adhkarIds: number[] = customIds;
    let templateId: number | null = null;

    if (customIds.length === 0) {
      templateId = kid?.wird_template_id ?? null;
      if (!templateId) {
        const { data: def } = await supabase
          .from("wird_templates")
          .select("id")
          .eq("age_group", kid?.age_group || "7-9")
          .eq("is_default", true)
          .single();
        templateId = def?.id ?? null;
      }
    }

    if (customIds.length === 0 && !templateId) {
      setLoading(false);
      return;
    }

    // Step 2: Fetch template (if using template) + today's log in parallel
    const logPromise = supabase
      .from("wird_logs")
      .select("completed_items, is_complete")
      .eq("kid_id", kidId)
      .eq("log_date", today)
      .single();

    let tmpl: any = null;
    if (templateId) {
      const tmplRes = await supabase
        .from("wird_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      tmpl = tmplRes.data;
      if (tmpl?.adhkar_ids?.length) adhkarIds = tmpl.adhkar_ids;
    } else if (customIds.length > 0) {
      // Custom wird: create synthetic template with age-based rewards
      tmpl = {
        id: null,
        name_ar: "ورد مخصص",
        name_en: "Custom Wird",
        reward_stars: getRewardStarsByAge(kid?.age_group || "7-9"),
        celebration_type: "confetti",
      };
    }

    const [logRes] = await Promise.all([logPromise]);

    setTemplate(tmpl);

    // Step 3: Fetch adhkar items by ids
    if (adhkarIds.length === 0) {
      setItems([]);
      setIsComplete(logRes.data?.is_complete || false);
      setLoading(false);
      cachedTemplateId.current = templateId;
      cachedAdhkarIds.current = [];
      return;
    }

    const { data: adhkarList } = await supabase
      .from("adhkar")
      .select("*")
      .in("id", adhkarIds)
      .eq("sharia_status", "approved");

    const completedIds = new Set(
      (logRes.data?.completed_items || []).map((i: any) => i.adhkar_id),
    );

    setItems(
      (adhkarList || []).map((a) => ({
        ...a,
        is_completed: completedIds.has(a.id),
      })),
    );
    setIsComplete(logRes.data?.is_complete || false);

    cachedTemplateId.current = templateId;
    cachedAdhkarIds.current = adhkarIds;

    setLoading(false);
  }

  function markItemDone(adhkarId: number) {
    isPendingWrite.current = true;
    setItems((prev) =>
      prev.map((a) => (a.id === adhkarId ? { ...a, is_completed: true } : a)),
    );
  }

  function markComplete() {
    isPendingWrite.current = true;
    setIsComplete(true);
  }

  function clearPendingWrite() {
    isPendingWrite.current = false;
  }

  return {
    items,
    template,
    isComplete,
    loading,
    refresh: fetchWird,
    markItemDone,
    markComplete,
    clearPendingWrite,
  };
}

// ─── Seasonal Wird Hook ───────────────────────────────────────────────────────
// Returns active seasonal wird template(s) for today's date,
// plus the kid's show_seasonal_wird preference.

interface SeasonalWirdItem {
  id: number | string;
  text_ar: string;
  text_en?: string;
  meaning_en?: string;
  repetition_count?: number;
  is_completed: boolean;
  is_custom?: boolean; // came from template custom_items
  is_kid_custom?: boolean; // came from kid seasonal_custom_items
}

interface SeasonalWirdResult {
  template: any | null;
  items: SeasonalWirdItem[];
  isComplete: boolean;
  showSeasonal: boolean;
  loading: boolean;
  refresh: () => void;
  markItemDone: (id: number | string) => void;
  markComplete: () => void;
  clearPendingWrite: () => void;
}

export function useSeasonalWird(kidId: string | null): SeasonalWirdResult {
  const [template, setTemplate] = useState<any>(null);
  const [items, setItems] = useState<SeasonalWirdItem[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [showSeasonal, setShowSeasonal] = useState(true);
  const [loading, setLoading] = useState(true);

  const isPendingWrite = useRef(false);
  // Caches all item IDs (adhkar numbers + custom strings) for fast-path completion check
  const cachedItemIds = useRef<(number | string)[]>([]);

  useEffect(() => {
    if (!kidId) {
      setLoading(false);
      return;
    }
    cachedItemIds.current = [];
    fetchSeasonalWird();

    const sub = supabase
      .channel("seasonal-wird-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wird_templates" },
        () => {
          cachedItemIds.current = [];
          fetchSeasonalWird();
        },
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [kidId]);

  async function fetchSeasonalWird() {
    if (isPendingWrite.current) return;

    const today = new Date().toISOString().split("T")[0];

    // Fast-path: only refresh the log
    if (cachedItemIds.current.length > 0 && template) {
      const { data: logRes } = await supabase
        .from("wird_logs")
        .select("seasonal_completed_items")
        .eq("kid_id", kidId)
        .eq("log_date", today)
        .maybeSingle();

      if (isPendingWrite.current) return;
      const completedLog: any[] = logRes?.seasonal_completed_items || [];
      const completedAdhkarIds = new Set(
        completedLog.filter((i) => i.adhkar_id != null).map((i) => i.adhkar_id),
      );
      const completedCustomIds = new Set(
        completedLog.filter((i) => i.item_id != null).map((i) => i.item_id),
      );
      setItems((prev) =>
        prev.map((a) => ({
          ...a,
          is_completed:
            a.is_custom || a.is_kid_custom
              ? completedCustomIds.has(a.id as string)
              : completedAdhkarIds.has(a.id as number),
        })),
      );
      setIsComplete(
        cachedItemIds.current.length > 0 &&
          cachedItemIds.current.every((id) =>
            typeof id === "string"
              ? completedCustomIds.has(id)
              : completedAdhkarIds.has(id),
          ),
      );
      return;
    }

    setLoading(true);

    // 1. Fetch kid's show_seasonal_wird flag + seasonal_custom_items
    const { data: kid } = await supabase
      .from("kids")
      .select("show_seasonal_wird, seasonal_custom_items")
      .eq("id", kidId)
      .single();

    const showFlag = kid?.show_seasonal_wird !== false;
    setShowSeasonal(showFlag);

    if (!showFlag) {
      setLoading(false);
      return;
    }

    // 2. Find active seasonal wird template for today
    const { data: templates } = await supabase
      .from("wird_templates")
      .select("*")
      .eq("is_active", true)
      .eq("is_seasonal", true)
      .lte("seasonal_from", today)
      .gte("seasonal_to", today)
      .limit(1);

    const tmpl = templates?.[0] ?? null;
    const adhkarIds: number[] = tmpl?.adhkar_ids || [];
    const templateCustom: any[] = tmpl?.custom_items || [];
    const kidCustom: any[] = kid?.seasonal_custom_items || [];

    if (!tmpl && templateCustom.length === 0 && kidCustom.length === 0) {
      setTemplate(null);
      setItems([]);
      setIsComplete(false);
      setLoading(false);
      return;
    }

    setTemplate(tmpl);

    // 3. Fetch today's wird log (seasonal completions are in their own column)
    const { data: logRes } = await supabase
      .from("wird_logs")
      .select("seasonal_completed_items")
      .eq("kid_id", kidId)
      .eq("log_date", today)
      .maybeSingle();

    const completedLog: any[] = logRes?.seasonal_completed_items || [];
    const completedAdhkarIds = new Set(
      completedLog.filter((i) => i.adhkar_id != null).map((i) => i.adhkar_id),
    );
    const completedCustomIds = new Set(
      completedLog.filter((i) => i.item_id != null).map((i) => i.item_id),
    );

    // 4. Fetch real adhkar items
    let adhkarItems: SeasonalWirdItem[] = [];
    if (adhkarIds.length > 0) {
      const { data: adhkarList } = await supabase
        .from("adhkar")
        .select("*")
        .in("id", adhkarIds)
        .eq("sharia_status", "approved");
      adhkarItems = (adhkarList || []).map((a) => ({
        ...a,
        is_completed: completedAdhkarIds.has(a.id),
      }));
    }

    // 5. Build custom items from template
    const tmplCustomItems: SeasonalWirdItem[] = templateCustom.map((c) => ({
      id: c.id,
      text_ar: c.text_ar,
      text_en: c.text_en,
      repetition_count: c.repeat || 1,
      is_custom: true,
      is_completed: completedCustomIds.has(c.id),
    }));

    // 6. Build custom items from kid
    const kidCustomItems: SeasonalWirdItem[] = kidCustom.map((c) => ({
      id: c.id,
      text_ar: c.text_ar,
      text_en: c.text_en,
      repetition_count: c.repeat || 1,
      is_kid_custom: true,
      is_completed: completedCustomIds.has(c.id),
    }));

    const allItems = [...adhkarItems, ...tmplCustomItems, ...kidCustomItems];
    const allIds = [
      ...adhkarIds,
      ...templateCustom.map((c) => c.id),
      ...kidCustom.map((c) => c.id),
    ];
    cachedItemIds.current = allIds;

    setItems(allItems);
    setIsComplete(
      allIds.length > 0 &&
        allIds.every((id) =>
          typeof id === "string"
            ? completedCustomIds.has(id)
            : completedAdhkarIds.has(id),
        ),
    );
    setLoading(false);
  }

  function markItemDone(id: number | string) {
    isPendingWrite.current = true;
    setItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_completed: true } : a)),
    );
  }

  function markComplete() {
    isPendingWrite.current = true;
    setIsComplete(true);
  }

  function clearPendingWrite() {
    isPendingWrite.current = false;
  }

  return {
    template,
    items,
    isComplete,
    showSeasonal,
    loading,
    refresh: fetchSeasonalWird,
    markItemDone,
    markComplete,
    clearPendingWrite,
  };
}
