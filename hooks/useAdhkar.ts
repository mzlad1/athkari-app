import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";
import type { Dhikr } from "@/types/database";

export function useAdhkar(categoryId: number | null) {
  const [adhkar, setAdhkar] = useState<Dhikr[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) return;

    async function fetchAdhkar() {
      setLoading(true);
      const { data } = await supabase
        .from("adhkar")
        .select("*")
        .eq("category_id", categoryId)
        .neq("sharia_status", "rejected")
        .order("id", { ascending: true });

      setAdhkar(data || []);
      setLoading(false);
    }

    fetchAdhkar();

    // Real-time: re-fetch when admin changes adhkar for this category
    const sub = supabase
      .channel(`adhkar-changes-${categoryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "adhkar",
          filter: `category_id=eq.${categoryId}`,
        },
        () => {
          fetchAdhkar();
        },
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, [categoryId]);

  return { adhkar, loading };
}
