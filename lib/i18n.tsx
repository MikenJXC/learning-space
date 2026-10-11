"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Languages } from "lucide-react";
import { translate, type Language } from "./translations";

type I18nValue = { language: Language; setLanguage: (language: Language) => void; t: (message: string, values?: Record<string, string | number>) => string };
const I18nContext = createContext<I18nValue>({language:"zh",setLanguage:()=>{},t:message=>message});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>("zh");
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("study-space-language"); } catch {}
    const next = saved === "zh" || saved === "en" ? saved : navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    updateLanguage(next);
  }, []);
  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    try { localStorage.setItem("study-space-language", next); } catch {}
  }, []);
  const t = useCallback((message: string, values?: Record<string, string | number>) => translate(language, message, values), [language]);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = t("学习空间");
  }, [language, t]);
  const value = useMemo(() => ({language,setLanguage,t}), [language,setLanguage,t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export const useT = () => useContext(I18nContext).t;
export function LanguageSwitcher({dark = false}: {dark?: boolean}) {
  const {language,setLanguage} = useContext(I18nContext);
  return <button type="button" onClick={()=>setLanguage(language === "zh" ? "en" : "zh")}
    aria-label={language === "zh" ? "Switch to English" : "切换为中文"} title={language === "zh" ? "Switch to English" : "切换为中文"}
    className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium ${dark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100"}`}><Languages className="size-4" /><span>{language === "zh" ? "English" : "中文"}</span></button>;
}
