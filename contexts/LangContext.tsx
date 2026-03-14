import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager, View } from "react-native";
import { Lang } from "@/constants/translations";
import { supabase } from "@/services/supabase";

interface LangContextType {
  lang: Lang;
  isRTL: boolean;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
}

const LANG_KEY = "@athkari_lang";

const LangContext = createContext<LangContextType>({
  lang: "ar",
  isRTL: true,
  setLang: () => {},
  toggleLang: () => {},
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    // Apply RTL for the default language (Arabic) immediately
    I18nManager.forceRTL(true);

    AsyncStorage.getItem(LANG_KEY).then(async (saved) => {
      if (saved === "en" || saved === "ar") {
        // User has a saved preference — use it
        setLangState(saved);
        I18nManager.forceRTL(saved === "ar");
      } else {
        // No saved preference — fetch default from server config
        try {
          const { data } = await supabase
            .from("app_config")
            .select("value")
            .eq("key", "default_lang")
            .single();
          if (data?.value === "en" || data?.value === "ar") {
            setLangState(data.value);
            I18nManager.forceRTL(data.value === "ar");
            AsyncStorage.setItem(LANG_KEY, data.value);
          }
        } catch {
          // keep default "ar"
        }
      }
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
    // Update RTL for Arabic
    I18nManager.forceRTL(l === "ar");
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "ar" ? "en" : "ar");
  }, [lang, setLang]);

  return (
    <LangContext.Provider
      value={{ lang, isRTL: lang === "ar", setLang, toggleLang }}
    >
      {/* Wrap with direction so RTL/LTR applies reactively without an app restart */}
      <View style={{ flex: 1, direction: lang === "ar" ? "rtl" : "ltr" }}>
        {children}
      </View>
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

