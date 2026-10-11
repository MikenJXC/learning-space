"use client";
import { LanguageSwitcher, useT } from "@/lib/i18n";
import { useState } from "react";
import { BookOpen, FileText, Grid3X3, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthScreen() {
  const t = useT();
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (register && password !== confirmation) { setError(t("两次输入的密码不一致")); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || t("操作失败，请重试"));
      window.location.replace("/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("网络异常，请重试")); setBusy(false); }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-[#f4f7fb] p-4 text-slate-950 sm:p-8">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,.08)] md:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-[#155EEF] p-10 text-white md:flex">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-white/15"><BookOpen /></span><span className="text-xl font-semibold">{t("学习空间")}</span></div>
        <div className="py-14"><p className="mb-4 text-sm tracking-widest text-blue-100">YOUR PERSONAL STUDY SPACE</p><h1 className="text-4xl font-semibold leading-[1.35] tracking-tight">{t("让每一章知识，")}<br />{t("都有自己的位置。")}</h1><p className="mt-5 text-base leading-7 text-blue-100">{t("用课程矩阵整理课件，接着上次的位置阅读。")}<br />{t("你的资料，只属于你的学习空间。")}</p></div>
        <div className="flex gap-6 text-sm text-blue-100"><span className="flex items-center gap-2"><Grid3X3 className="size-4" />{t("课程 × 章节")}</span><span className="flex items-center gap-2"><FileText className="size-4" />{t("多格式阅读")}</span></div>
      </section>
      <section className="p-6 sm:p-10">
        <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
        <div className="mb-8 flex items-center gap-3 md:hidden"><span className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-[#155EEF]"><BookOpen /></span><span className="text-lg font-semibold">{t("学习空间")}</span></div>
        <div className="mb-7"><div className="mb-4 flex h-11 items-center rounded-xl bg-slate-100 p-1" aria-label={t("登录或注册")}>
          <button type="button" disabled={busy} onClick={() => { setRegister(false); setError(""); setPassword(""); setConfirmation(""); }} aria-pressed={!register} className={`h-full flex-1 rounded-lg text-sm font-medium ${!register ? "bg-white text-[#155EEF] shadow-sm" : "text-slate-500"}`}>{t("登录")}</button>
          <button type="button" disabled={busy} onClick={() => { setRegister(true); setError(""); setPassword(""); setConfirmation(""); }} aria-pressed={register} className={`h-full flex-1 rounded-lg text-sm font-medium ${register ? "bg-white text-[#155EEF] shadow-sm" : "text-slate-500"}`}>{t("注册")}</button>
        </div><h2 className="text-2xl font-semibold">{register ? t("创建你的学习空间") : t("欢迎回来")}</h2><p className="mt-2 text-sm text-slate-500">{register ? t("只需用户名和密码，不需要 ChatGPT 账号。") : t("使用网站用户名和密码，继续你的学习。")}</p></div>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="username">{t("用户名")}</Label><Input id="username" name="username" required minLength={3} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} className="h-12 text-base" placeholder={t("输入用户名")} />{register && <p className="text-xs leading-5 text-slate-500">{t("3–32 个汉字、字母、数字、下划线或短横线；不区分大小写。")}</p>}</div>
          <div className="space-y-2"><Label htmlFor="password">{t("密码")}</Label><Input id="password" name="password" required type="password" minLength={register ? 9 : undefined} maxLength={128} autoComplete={register ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} className="h-12 text-base" placeholder={register ? t("至少 9 个字符，可使用长口令") : t("输入密码")} /></div>
          {register && <div className="space-y-2"><Label htmlFor="confirm-password">{t("确认密码")}</Label><Input id="confirm-password" type="password" required maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="h-12 text-base" placeholder={t("再次输入密码")} /></div>}
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
          <Button type="submit" disabled={busy} className="h-12 w-full bg-[#155EEF] text-base hover:bg-[#0F4FD6]">{busy ? t("正在处理…") : register ? t("注册并进入") : t("登录学习空间")}</Button>
        </form>
        <div className="mt-6 flex items-start gap-2 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 size-4 shrink-0" /><p>{t("每个账号拥有独立的课件和阅读进度。请妥善保存密码；当前暂不提供忘记密码找回功能。")}</p></div>
      </section>
    </div>
  </main>;
}
