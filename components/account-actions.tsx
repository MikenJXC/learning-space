"use client";
import { LanguageSwitcher, useT } from "@/lib/i18n";
import { useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
export function AccountActions() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(t("退出失败，请重试"));
      // A new document discards the previous user's in-memory course data.
      window.location.replace("/login");
    } catch { setError(t("退出失败，请重试")); setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-1">
    <LanguageSwitcher />
    <Button asChild variant="ghost" size="sm" className="min-h-11"><a href="/account" aria-label={t("用户中心")}><UserRound /><span className="hidden sm:inline">{t("用户中心")}</span></a></Button>
    <Button variant="ghost" size="sm" className="min-h-11" aria-label={t("退出")} disabled={busy} onClick={() => void logout()}><LogOut /><span className="hidden sm:inline">{busy ? t("退出中") : t("退出")}</span></Button>
    {error && <span role="alert" className="text-xs text-red-600">{t(error)}</span>}
  </div>;
}
