"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Languages, Settings, TrendingUp } from "lucide-react";
import { LanguageSwitcher, useT } from "@/lib/i18n";
import { AccountCenter } from "@/app/account/account-center";
import type { AssetKind, LibraryCourse, LibraryResponse } from "@/lib/library-types";

export function SettingsCenter({ username, role }: { username: string; role: string }) {
  const t = useT();
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/library", { cache: "no-store" });
        const data = await response.json() as LibraryResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || "课件库读取失败");
        if (!cancelled) setCourses(data.courses);
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "课件库读取失败"); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  async function changeBasis(courseId: string, progressBasis: AssetKind) {
    setSaving(state => ({ ...state, [courseId]: true }));
    setMessages(state => ({ ...state, [courseId]: "正在保存…" }));
    try {
      const response = await fetch(`/api/courses/${courseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ progressBasis }) });
      const data = await response.json() as { saved?: boolean; error?: string };
      if (!response.ok || !data.saved) throw new Error(data.error || "设置保存失败");
      setCourses(items => items.map(item => item.id === courseId ? { ...item, progressBasis } : item));
      setMessages(state => ({ ...state, [courseId]: "已保存" }));
    } catch (cause) { setMessages(state => ({ ...state, [courseId]: cause instanceof Error ? cause.message : "设置保存失败" })); }
    finally { setSaving(state => ({ ...state, [courseId]: false })); }
  }

  return <main className="min-h-dvh bg-[#f4f7fb] text-slate-950">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8"><a href="/" className="flex min-h-11 items-center gap-2 font-semibold"><BookOpen className="size-5 text-[#155EEF]" />{t("学习空间")}</a><a href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600"><ArrowLeft className="size-4" />{t("返回课程矩阵")}</a></div></header>
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:py-10">
      <h1 className="flex items-center gap-3 text-3xl font-semibold"><Settings className="size-7 text-[#155EEF]" />{t("设置")}</h1>
      <nav aria-label={t("设置分类")} className="flex flex-wrap gap-3 text-sm text-[#155EEF]">{[["language", "语言"], ["progress", "进度条依据"], ["account", "用户中心"]].map(([id, label]) => <a key={id} className="inline-flex min-h-11 items-center rounded-lg border border-blue-100 bg-white px-4" href={`#${id}`}>{t(label)}</a>)}</nav>
      <section id="language" className="scroll-mt-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-semibold"><Languages className="size-5 text-[#155EEF]" />{t("语言")}</h2><LanguageSwitcher /></div><p className="mt-3 text-sm leading-6 text-slate-500">{t("切换界面语言，课程名称和上传文件内容保持原样。")}</p></section>
      <section id="progress" className="scroll-mt-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-8"><h2 className="flex items-center gap-2 text-xl font-semibold"><TrendingUp className="size-5 text-[#155EEF]" />{t("进度条依据")}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{t("每门课程独立选择。设置自动保存并跨设备同步，不会清除任何阅读位置。")}</p><p className="mt-2 text-xs leading-5 text-slate-500">{t("选择学习文档后，仅显示学习文档的阅读进度；没有学习文档的章节会显示暂无学习文档。同一类型有多份文件时，以最近阅读的文件为准。")}</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{t(error)}</p>}
        {loading ? <p className="py-6 text-sm text-slate-500">{t("正在读取…")}</p> : !courses.length ? <p className="py-6 text-sm text-slate-500">{t("暂无课程，创建课程后可在这里设置。")}</p> : <div className="mt-5 divide-y divide-slate-100">{courses.map(course => <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><label htmlFor={`basis-${course.id}`} className="min-w-0 flex-1 basis-40 break-words text-sm font-medium">{course.name}</label><div className="flex min-w-0 flex-col gap-1"><select id={`basis-${course.id}`} aria-label={t("{0}的进度条依据", {"0":course.name})} value={course.progressBasis ?? "slides"} disabled={saving[course.id]} onChange={event => void changeBasis(course.id, event.target.value as AssetKind)} className="min-h-11 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-base disabled:opacity-60"><option value="slides">{t("PPT阅读进度")}</option><option value="study">{t("学习文档阅读进度")}</option></select><span role="status" className="min-h-4 text-xs text-slate-500">{t(messages[course.id] ?? "")}</span></div></div>)}</div>}
      </section>
      <section id="account" className="scroll-mt-5"><AccountCenter username={username} role={role} embedded /></section>
    </div>
  </main>;
}
