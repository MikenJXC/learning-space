"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Check, Clock3, Flame, RefreshCw, Sparkles, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsLink } from "@/components/settings-link";
import { useT } from "@/lib/i18n";
import { courseProgress, readingPercent } from "@/lib/course-progress";
import type { LibraryResponse } from "@/lib/library-types";
import { dayKey, effortDays, effortStreak, type EffortSummary } from "@/lib/study-effort";

export function EffortDashboard() {
  const t = useT();
  const [days, setDays] = useState(90), [data, setData] = useState<EffortSummary | null>(null);
  const [library, setLibrary] = useState<LibraryResponse>({ courses: [] });
  const [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [selectedDay, setSelectedDay] = useState(""), [selectedHour, setSelectedHour] = useState<number | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    try {
      const responses = await Promise.all([fetch(`/api/effort?days=${days}&offset=${-new Date().getTimezoneOffset()}`, { cache: "no-store", signal }), fetch("/api/library", { cache: "no-store", signal })]);
      const [summary, courses] = await Promise.all([responses[0].json() as Promise<EffortSummary & { error?: string }>, responses[1].json() as Promise<LibraryResponse & { error?: string }>]);
      if (responses.some(r => !r.ok)) throw new Error(summary.error || courses.error || "学习统计读取失败");
      setData(summary); setLibrary(courses); setError("");
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "学习统计读取失败");
    } finally { if (!signal?.aborted) setBusy(false); }
  }, [days]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const refresh = () => { if (document.visibilityState === "visible") void load(controller.signal); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);
  const duration = (ms: number) => ms < 60000 ? t("{0}秒", { "0": Math.floor(ms / 1000) }) : ms < 3600000 ? t("{0}分钟", { "0": Math.floor(ms / 60000) }) : t("{0}小时 {1}分", { "0": Math.floor(ms / 3600000), "1": Math.floor(ms / 60000) % 60 });
  const dateText = (time: number) => new Date(time).toLocaleDateString();
  const timeText = (time: number) => new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const daily = data ? effortDays(data.generatedAt, data.days, data.offset, data.daily) : [];
  const streak = data ? effortStreak(daily, dayKey(data.generatedAt, data.offset)) : 0;
  const activeDays = daily.filter(d => d.activeMs >= 10000).length;
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, activeMs: Number(data?.hours.find(d => d.hour === hour)?.activeMs ?? 0) }));
  const maxHour = Math.max(1, ...hours.map(d => d.activeMs));
  const bestHour = hours.reduce((a, b) => b.activeMs > a.activeMs ? b : a, hours[0]);
  const courseRows = library.courses.map(course => {
    const chapters = course.chapters.filter(c => c.chapterNumber > 0);
    const percentages = chapters.map(chapter => { const item = courseProgress(course, chapter); return item.progress && item.lastRead ? readingPercent(item.progress.page, item.progress.totalPages, item.lastRead.fileName) : 0; });
    return { ...course, count: chapters.length, finished: percentages.filter(p => p === 100).length, percent: percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0, activeMs: Number(data?.courses.find(c => c.courseId === course.id)?.activeMs ?? 0) };
  }).sort((a, b) => b.activeMs - a.activeMs);
  const panel = "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7";
  const medals = [
    { name: t("迈出第一步"), detail: t("完成一次有效学习"), earned: (data?.sessions ?? 0) > 0 },
    { name: t("一小时的积累"), detail: t("累计学习达到1小时"), earned: (data?.lifetimeMs ?? 0) >= 3600000 },
    { name: t("保持节奏"), detail: t("当前连续学习达到3天"), earned: streak >= 3 },
    { name: t("读完一章"), detail: t("至少一章阅读位置到达末页"), earned: courseRows.some(c => c.finished > 0) },
  ];
  return <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8"><a href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"><ArrowLeft className="size-4" />{t("返回课程矩阵")}</a><SettingsLink /></div></header>
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-9">
      <section className="relative overflow-hidden rounded-3xl bg-[#1555e8] p-6 text-white sm:p-9">
        <div className="pointer-events-none absolute -right-12 -top-16 size-80 rounded-full border-[48px] border-white/[.06]" />
        <div className="relative flex flex-wrap items-start justify-between gap-5"><div><p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-widest text-blue-100"><Sparkles className="size-4" />{t("把坚持变成看得见的积累")}</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("我的努力成果")}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">{t("每一次打开、每一段专注、每一章进展，都在这里留下足迹。")}</p></div><div className="rounded-2xl bg-white/10 p-4 text-sm"><span className="block text-xs text-blue-100">{t("累计有效学习")}</span><strong className="mt-1 block text-2xl font-semibold tabular-nums">{data ? duration(data.lifetimeMs) : "—"}</strong></div></div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-xl border border-slate-200 bg-white p-1" aria-label={t("统计范围")}>{[7, 30, 90].map(value => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={`min-h-11 rounded-lg px-4 text-sm font-medium ${days === value ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{t("近{0}天", { "0": value })}</button>)}</div><Button variant="outline" className="min-h-11" onClick={() => void load()} disabled={busy}><RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />{t("刷新")}</Button></div>
      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{t(error)} <button className="ml-2 min-h-11 underline" onClick={() => void load()}>{t("再试一次")}</button></div>}
      {!data ? <div className={`${panel} text-center text-slate-500`} role="status">{t(busy ? "正在读取…" : "学习统计读取失败")}</div> : <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("学习概览")}>
          {[
            { icon: Clock3, label: t("有效学习时长"), value: duration(data.activeMs), note: t("所选日期范围") },
            { icon: BookOpen, label: t("学习次数"), value: String(data.sessions), note: t("单次累计至少10秒") },
            { icon: CalendarDays, label: t("学习天数"), value: t("{0}天", { "0": activeDays }), note: t("当天累计至少10秒") },
            { icon: Flame, label: t("当前连续学习"), value: t("{0}天", { "0": streak }), note: t("在所选范围内，允许今天尚未开始") },
          ].map(({ icon: Icon, label, value, note }) => <div key={label} className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5"><Icon className="mb-4 size-5 text-blue-600" /><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p><p className="mt-2 text-[11px] leading-5 text-slate-400">{note}</p></div>)}
        </section>
        {!data.firstRecordedAt && <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-800"><Timer className="mt-1 size-5 shrink-0" /><div><strong>{t("从下一次学习开始记录")}</strong><p>{t("打开任意课件或学习文档，停留并阅读10秒以上，再回来看看你的第一条足迹。")}</p><a href="/" className="mt-2 inline-flex min-h-11 items-center gap-1 font-semibold">{t("去学习")}<ArrowUpRight className="size-4" /></a></div></div>}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <section className={panel}><h2 className="text-lg font-semibold">{t("学习日历")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("颜色越深，当天的有效学习时长越多。点击方格查看详情。")}</p><div className="mt-6 overflow-x-auto pb-2"><div className="grid min-w-64 grid-flow-col grid-rows-7 gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.ceil(daily.length / 7)}, minmax(18px, 28px))` }}>{daily.map(d => <button key={d.date} type="button" title={`${d.date} · ${duration(d.activeMs)}`} aria-label={`${d.date} · ${duration(d.activeMs)}`} onClick={() => setSelectedDay(d.date)} className={`aspect-square min-h-6 rounded-md outline-offset-2 focus-visible:outline-2 focus-visible:outline-blue-600 ${heatClass(d.activeMs)}`} />)}</div></div><DayDetail daily={daily} duration={duration} date={selectedDay} /><div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-400"><span>{daily[0]?.date} — {daily.at(-1)?.date}</span><span className="flex items-center gap-1">{t("少")}{[0, 1000, 600000, 1800000, 3600000].map(ms => <i key={ms} className={`size-3 rounded-sm ${heatClass(ms)}`} />)}{t("多")}</span></div></section>
          <section className={panel}><h2 className="text-lg font-semibold">{t("你在哪个时段学习")}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{t("按当前设备的本地时间统计，每根柱子代表一小时。")}</p><div className="mt-6 flex h-36 items-end gap-1 border-b border-slate-100" aria-label={t("24小时学习分布")}>{hours.map(h => <button key={h.hour} type="button" onClick={() => setSelectedHour(h.hour)} aria-label={`${h.hour}:00–${h.hour + 1}:00 · ${duration(h.activeMs)}`} title={`${h.hour}:00–${h.hour + 1}:00 · ${duration(h.activeMs)}`} style={{ height: h.activeMs ? `${Math.max(4, h.activeMs / maxHour * 100)}%` : "3%" }} className={`min-w-0 flex-1 rounded-t-sm outline-offset-2 focus-visible:outline-2 ${h.activeMs ? "bg-blue-500 hover:bg-blue-700" : "bg-slate-100"}`} />)}</div><div className="mt-2 flex justify-between text-[11px] text-slate-400">{["00:00", "06:00", "12:00", "18:00", "24:00"].map(label => <span key={label}>{label}</span>)}</div><HourDetail hours={hours} duration={duration} hour={selectedHour} /><p className="mt-4 text-xs text-slate-500">{bestHour.activeMs ? t("最常学习的时段：{0}:00–{1}:00", { "0": bestHour.hour, "1": bestHour.hour + 1 }) : t("还没有学习时段记录")}</p></section>
        </div>
        <section className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{t("课程积累与进度")}</h2><a href="/settings" className="inline-flex min-h-11 items-center text-xs font-medium text-blue-600">{t("修改进度条依据")} →</a></div><p className="mb-4 text-xs leading-5 text-slate-500">{t("进度是当前阅读位置，沿用课程矩阵的PPT或学习文档依据；各章等权，不代表知识掌握程度。课程资料不计入章节平均值。")}</p>{!courseRows.length ? <p className="py-6 text-sm text-slate-400">{t("还没有课程，先去矩阵添加一门课吧。")}</p> : <div className="grid gap-3 md:grid-cols-2">{courseRows.map(course => <a key={course.id} href={course.chapters[0] ? `/study/${course.id}/${course.chapters[0].chapterNumber}` : "/"} className="rounded-2xl border border-slate-100 p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{course.name}</h3><p className="mt-1 text-[11px] text-slate-400">{t(course.progressBasis === "study" ? "依据学习文档" : "依据PPT")} · {t("读至末页 {0}/{1} 章", { "0": course.finished, "1": course.count })}</p></div><strong className="shrink-0 text-sm text-blue-600">{course.percent}%</strong></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={course.name} aria-valuenow={course.percent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-blue-500" style={{ width: `${course.percent}%` }} /></div><p className="mt-3 text-xs text-slate-500">{t("本范围投入：{0}", { "0": duration(course.activeMs) })}</p></a>)}</div>}</section>
        <section className={panel}><h2 className="mb-5 flex items-center gap-2 text-lg font-semibold"><Trophy className="size-5 text-amber-500" />{t("小小里程碑")}</h2><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{medals.map(m => <div key={m.name} className={`rounded-2xl border p-4 ${m.earned ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}><span className={`mb-3 inline-flex size-8 items-center justify-center rounded-full ${m.earned ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-400"}`}>{m.earned ? <Check className="size-4" /> : <Sparkles className="size-4" />}</span><h3 className="text-sm font-semibold">{m.name}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{m.detail}</p><p className="mt-2 text-[11px] text-slate-400">{t(m.earned ? "已达成" : "继续积累")}</p></div>)}</div></section>
        <section className={panel}><h2 className="mb-5 text-lg font-semibold">{t("最近的学习足迹")}</h2>{!data.recent.length ? <p className="py-5 text-sm text-slate-400">{t("这个范围内还没有达到10秒的学习记录。")}</p> : <ol className="divide-y divide-slate-100">{data.recent.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-4 first:pt-0"><div className="min-w-0"><p className="break-words text-sm font-medium">{item.courseName} <span className="font-normal text-slate-400">· {item.chapterNumber === 0 ? t("课程资料") : t("第 {0} 章", { "0": item.chapterNumber })}</span></p><p className="mt-1 text-xs text-slate-400">{dateText(item.startedAt)} · {timeText(item.startedAt)}–{timeText(item.lastAt)}</p></div><span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium tabular-nums text-blue-700">{duration(item.activeMs)}</span></li>)}</ol>}</section>
        <footer className="rounded-2xl border border-dashed border-slate-200 p-5 text-xs leading-6 text-slate-500"><h2 className="font-semibold text-slate-700">{t("这些数字如何记录")}</h2><p>{t("仅在阅读台文档已打开、页面可见且窗口聚焦时计时。后台、失焦或2分钟无操作会暂停；阅读台底部可点击继续。每15秒同步，同一账号多窗口按时间片合并去重，时长为估算值。一次进入某章累计10秒才计为一次学习，切换文档不会增加次数。")}</p><p className="mt-2">{t("学习次数与时长从此功能上线后开始记录，不补造过去的数据；原有阅读进度保留。历史足迹保留当时课程名称，删除课程后仍会计入时长。短暂断网会尝试重传最近10分钟的记录，更长断网可能遗漏。")}</p>{data.firstRecordedAt && <p className="mt-2">{t("第一条记录：{0} · 页面每30秒自动刷新", { "0": dateText(data.firstRecordedAt) })}</p>}</footer>
      </>}
    </div>
  </main>;
}

function heatClass(ms: number) { return ms === 0 ? "bg-slate-100 hover:bg-slate-200" : ms < 600000 ? "bg-blue-200 hover:bg-blue-300" : ms < 1800000 ? "bg-blue-400 hover:bg-blue-500" : ms < 3600000 ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-900 hover:bg-blue-950"; }

function DayDetail({ daily, duration, date }: { daily: Array<{ date: string; activeMs: number }>; duration: (ms: number) => string; date: string }) {
  const t = useT();
  const selected = daily.find(d => d.date === date);
  return <p className="mt-2 min-h-5 text-xs text-blue-600" role="status">{selected ? `${date} · ${duration(selected.activeMs)}` : t("选择一天查看学习时长")}</p>;
}
function HourDetail({ hours, duration, hour }: { hours: Array<{ hour: number; activeMs: number }>; duration: (ms: number) => string; hour: number | null }) {
  const t = useT();
  return <p className="mt-2 min-h-5 text-xs text-blue-600" role="status">{hour === null ? t("选择时段查看学习时长") : `${hour}:00–${hour + 1}:00 · ${duration(hours[hour].activeMs)}`}</p>;
}
