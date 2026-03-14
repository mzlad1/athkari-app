import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";
import type { Category } from "@/types/database";

let categoriesCache: Category[] | null = null;

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(
    categoriesCache || [],
  );
  const [loading, setLoading] = useState(!categoriesCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();

    // Real-time subscription: update when admin changes categories
    const subscription = supabase
      .channel("categories-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => {
          fetchCategories();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .eq("sharia_status", "published")
        .order("display_order");

      if (error) throw error;
      categoriesCache = data || [];
      setCategories(categoriesCache);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return { categories, loading, error, refresh: fetchCategories };
}
