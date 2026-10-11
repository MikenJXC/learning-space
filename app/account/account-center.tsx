"use client";
import { useT } from "@/lib/i18n";
import { useState } from "react";
import { ArrowLeft, BookOpen, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountActions } from "@/components/account-actions";

export function AccountCenter({ username: initialUsername, role }: { username: string; role: string }) {
  const t = useT();
  const [username, setUsername] = useState(initialUsername);
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError("");
    if (password !== confirmation) { setError(t("两次输入的新密码不一致")); return; }
    if (username.trim() === savedUsername && !password) { setError(t("请修改用户名或输入新密码")); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, username, ...(password ? { password } : {}) }) });
      const data = await response.json() as { user?: { username: string }; error?: string; message?: string };
      if (!response.ok || !data.user) throw new Error(data.error || t("修改失败"));
      setUsername(data.user.username); setSavedUsername(data.user.username); setCurrentPassword(""); setPassword(""); setConfirmation(""); setMessage(data.message || t("已保存"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("网络异常，请重试")); }
    finally { setBusy(false); }
  }
  return <main className="min-h-dvh bg-[#f4f7fb] text-slate-950">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:px-8"><a href="/" className="flex items-center gap-2 font-semibold"><BookOpen className="size-5 text-[#155EEF]" />{t("学习空间")}</a><AccountActions /></div></header>
    <section className="mx-auto max-w-2xl px-4 py-6 sm:py-12">
      <a href="/" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"><ArrowLeft className="size-4" />{t("返回课程矩阵")}</a>
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-4"><span className="grid size-14 place-items-center rounded-2xl bg-blue-50 text-[#155EEF]"><UserRound className="size-7" /></span><div><h1 className="text-2xl font-semibold">{t("用户中心")}</h1><p className="mt-1 break-all text-sm text-slate-500">{savedUsername} · {role === "owner" ? t("管理员") : t("普通用户")}</p></div></div>
        <form onSubmit={save} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="account-username">{t("用户名")}</Label><Input id="account-username" required minLength={3} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} className="h-12 text-base" value={username} onChange={event => setUsername(event.target.value)} /><p className="text-xs leading-5 text-slate-500">{t("修改后请使用新用户名登录，课件和阅读进度不变。")}</p></div>
          <div className="space-y-2"><Label htmlFor="current-password">{t("当前密码（确认身份）")}</Label><Input id="current-password" required type="password" maxLength={128} autoComplete="current-password" className="h-12 text-base" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="new-password">{t("新密码（不修改则留空）")}</Label><Input id="new-password" type="password" minLength={9} maxLength={128} autoComplete="new-password" className="h-12 text-base" value={password} onChange={event => setPassword(event.target.value)} placeholder={t("至少 9 个字符，可使用长口令")} /></div>
          <div className="space-y-2"><Label htmlFor="confirm-new-password">{t("确认新密码")}</Label><Input id="confirm-new-password" type="password" required={!!password} maxLength={128} autoComplete="new-password" className="h-12 text-base" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
          {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{t(message)}</p>}
          <Button type="submit" disabled={busy} className="h-12 w-full bg-[#155EEF] hover:bg-[#0F4FD6]">{busy ? t("正在保存…") : t("保存修改")}</Button>
        </form>
        <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0" />{t("修改账号资料后，其他设备的旧登录会失效；当前设备继续保持登录。")}</p>
      </div>
    </section>
  </main>;
}
