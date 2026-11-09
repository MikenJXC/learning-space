"use client";
import { useT } from "@/lib/i18n";
import { SettingsLink } from "./settings-link";
import { useState } from "react";
import { LogOut } from "lucide-react";
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
    <SettingsLink />
    <Button variant="ghost" size="sm" className="min-h-11" aria-label={t("退出")} disabled={busy} onClick={() => void logout()}><LogOut /><span className="hidden sm:inline">{busy ? t("退出中") : t("退出")}</span></Button>
    {error && <span role="alert" className="text-xs text-red-600">{t(error)}</span>}
  </div>;
}
