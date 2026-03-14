import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/services/supabase";
import type { Session, User } from "@supabase/supabase-js";
import type { Kid, Family } from "@/types/database";

const ROLE_KEY = "@athkari_role";
const ACTIVE_KID_KEY = "@athkari_active_kid_id";
const ACTIVE_KID_DATA_KEY = "@athkari_active_kid_data";

interface AuthState {
  session: Session | null;
  user: User | null;
  family: Family | null;
  kids: Kid[];
  activeKid: Kid | null;
  role: "parent" | "kid" | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  setActiveKid: (kid: Kid) => void;
  setRole: (role: "parent" | "kid" | null) => void;
  refreshFamily: () => Promise<void>;
  refreshKids: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    family: null,
    kids: [],
    activeKid: null,
    role: null,
    loading: true,
  });

  const storedKidIdRef = useRef<string | null>(null);

  // Refresh token when app comes back to foreground (fixes "invalid refresh token" after 8h)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        supabase.auth.getSession();
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  // Bootstrap: restore persisted state, then listen for auth changes
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const bootstrap = async () => {
      // 1) Restore persisted role & active-kid before any session check
      const [savedRole, savedKidId] = await Promise.all([
        AsyncStorage.getItem(ROLE_KEY),
        AsyncStorage.getItem(ACTIVE_KID_KEY),
      ]);
      if (savedRole === "kid" || savedRole === "parent") {
        setState((prev) => ({ ...prev, role: savedRole as "kid" | "parent" }));
      }
      storedKidIdRef.current = savedKidId;

      // 2) Auth state listener
      const { data } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (
            event === "SIGNED_OUT" ||
            (!session && event !== "INITIAL_SESSION")
          ) {
            AsyncStorage.multiRemove([ROLE_KEY, ACTIVE_KID_KEY]).catch(
              () => {},
            );
            setState({
              session: null,
              user: null,
              family: null,
              kids: [],
              activeKid: null,
              role: null,
              loading: false,
            });
            return;
          }

          setState((prev) => ({
            ...prev,
            session,
            user: session?.user ?? null,
          }));
          if (session?.user) {
            await loadFamilyData(session.user.id);
          } else {
            setState((prev) => ({
              ...prev,
              family: null,
              kids: [],
              activeKid: null,
              role: null,
              loading: false,
            }));
          }
        },
      );
      subscription = data.subscription;

      // 3) Initial session check
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));
      if (session?.user) {
        await loadFamilyData(session.user.id);
      } else {
        // No Supabase session — try restoring QR-only kid session
        if (savedRole === "kid" && savedKidId) {
          try {
            const kidDataStr = await AsyncStorage.getItem(ACTIVE_KID_DATA_KEY);
            if (kidDataStr) {
              const kidData = JSON.parse(kidDataStr) as Kid;
              setState((prev) => ({
                ...prev,
                activeKid: kidData,
                role: "kid",
                loading: false,
              }));
            } else {
              setState((prev) => ({ ...prev, loading: false }));
            }
          } catch {
            setState((prev) => ({ ...prev, loading: false }));
          }
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    bootstrap();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const loadFamilyData = async (authUserId: string) => {
    try {
      // Get family
      const { data: family } = await supabase
        .from("families")
        .select("*")
        .eq("auth_user_id", authUserId)
        .single();

      if (family) {
        // Get kids
        const { data: kids } = await supabase
          .from("kids")
          .select("*")
          .eq("family_id", family.id)
          .order("created_at");

        const kidsList = kids || [];

        const savedKidId = storedKidIdRef.current;
        setState((prev) => ({
          ...prev,
          family,
          kids: kidsList,
          // For kids: use current activeKid or restore from persisted ID
          activeKid:
            prev.role === "kid"
              ? prev.activeKid ||
                (savedKidId
                  ? kidsList.find((k) => k.id === savedKidId) || null
                  : null)
              : kidsList.length > 0
                ? (prev.activeKid ?? kidsList[0])
                : null,
          role:
            prev.role === "kid"
              ? "kid"
              : prev.role || (kidsList.length > 0 ? "parent" : null),
          loading: false,
        }));
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      console.error("Failed to load family data:", err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const setActiveKid = useCallback((kid: Kid) => {
    setState((prev) => ({ ...prev, activeKid: kid }));
    AsyncStorage.setItem(ACTIVE_KID_KEY, kid.id).catch(() => {});
    // Persist full kid data so QR-only sessions survive app restart
    AsyncStorage.setItem(ACTIVE_KID_DATA_KEY, JSON.stringify(kid)).catch(
      () => {},
    );
  }, []);

  const setRole = useCallback((role: "parent" | "kid" | null) => {
    setState((prev) => ({ ...prev, role }));
    if (role) {
      AsyncStorage.setItem(ROLE_KEY, role).catch(() => {});
    } else {
      AsyncStorage.removeItem(ROLE_KEY).catch(() => {});
    }
  }, []);

  const refreshFamily = useCallback(async () => {
    if (!state.user) return;
    const { data: family } = await supabase
      .from("families")
      .select("*")
      .eq("auth_user_id", state.user.id)
      .single();
    if (family) {
      setState((prev) => ({ ...prev, family }));
    }
  }, [state.user]);

  const refreshKids = useCallback(async () => {
    if (!state.family) return;
    const { data: kids } = await supabase
      .from("kids")
      .select("*")
      .eq("family_id", state.family.id)
      .order("created_at");
    const kidsList = kids || [];
    setState((prev) => ({
      ...prev,
      kids: kidsList,
      role: prev.role || (kidsList.length > 0 ? "parent" : null),
      activeKid: prev.activeKid
        ? kidsList.find((k) => k.id === prev.activeKid!.id) || null
        : prev.role === "parent"
          ? kidsList[0] || null
          : null,
    }));
  }, [state.family]);

  const logout = useCallback(async () => {
    // Clear persisted kid data (QR-only sessions have no Supabase session)
    await AsyncStorage.multiRemove([
      ROLE_KEY,
      ACTIVE_KID_KEY,
      ACTIVE_KID_DATA_KEY,
    ]).catch(() => {});
    // Clear Supabase session if one exists
    await supabase.auth.signOut().catch(() => {});
    // Reset state (signOut event may not fire if there was no session)
    setState({
      session: null,
      user: null,
      family: null,
      kids: [],
      activeKid: null,
      role: null,
      loading: false,
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        setActiveKid,
        setRole,
        refreshFamily,
        refreshKids,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
