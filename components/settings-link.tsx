"use client";
import { Settings } from "lucide-react";
import { useT } from "@/lib/i18n";
export function SettingsLink({ dark = false }: { dark?: boolean }) {
  const t = useT();
  return <a href="/settings" aria-label={t("设置")} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium ${dark ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-600 hover:bg-slate-100"}`}><Settings className="size-4" /><span className="hidden sm:inline">{t("设置")}</span></a>;
}
