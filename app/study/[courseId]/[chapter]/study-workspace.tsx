"use client";
import { LanguageSwitcher, useT } from "@/lib/i18n";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, Columns2, Download, FileText, Maximize2, Minimize2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentViewer } from "@/components/document-viewer";
import type { LibraryAsset, LibraryResponse } from "@/lib/library-types";
import { downloadUrl } from "@/lib/download-url";
import { getReadingProgress } from "@/lib/reading-progress";
import { useMobileEdition } from "@/lib/use-mobile-edition";

type ViewMode = "slides" | "study" | "split";

export function StudyWorkspace({
  initialCourseId,
  initialChapterNumber,
}: {
  initialCourseId: string;
  initialChapterNumber: number;
}) {
  const t = useT();
  const router = useRouter();
  const [library, setLibrary] = useState<LibraryResponse>({ courses: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<ViewMode>("slides");
  const [selectedSlideId, setSelectedSlideId] = useState("");
  const [selectedStudyId, setSelectedStudyId] = useState("");
  const mobile = useMobileEdition();
  const [focused, setFocused] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/library", { cache: "no-store" });
      const data = (await response.json()) as LibraryResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || t("读取章节失败"));
      setLibrary({ courses: data.courses.map((course) => ({ ...course, chapters: course.chapters.map((chapter) => ({
        ...chapter, assets: chapter.assets.map((asset) => ({ ...asset, progress: getReadingProgress(asset) })),
      })) })) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("读取章节失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const course = library.courses.find((item) => item.id === initialCourseId);
  const chapter = course?.chapters.find((item) => item.chapterNumber === initialChapterNumber);
  const slideFiles = chapter?.assets.filter((asset) => asset.kind === "slides") ?? [];
  const studyFiles = chapter?.assets.filter((asset) => asset.kind === "study") ?? [];
  const lastSlide = [...slideFiles].sort((a, b) => (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0))[0];
  const lastStudy = [...studyFiles].sort((a, b) => (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0))[0];
  const slides = slideFiles.find((asset) => asset.id === selectedSlideId) ?? lastSlide;
  const study = studyFiles.find((asset) => asset.id === selectedStudyId) ?? lastStudy;

  useEffect(() => {
    setSelectedSlideId("");
    setSelectedStudyId("");
  }, [initialCourseId, initialChapterNumber]);

  useEffect(() => {
    if (!slides && study) setMode("study");
    else if ((!study && mode !== "slides") || (mobile && mode === "split")) setMode("slides");
  }, [slides, study, mode, mobile]);

  const chapters = useMemo(
    () => [...(course?.chapters ?? [])].sort((a, b) => a.chapterNumber - b.chapterNumber),
    [course],
  );

  function navigate(courseId: string, chapterNumber?: number) {
    const targetCourse = library.courses.find((item) => item.id === courseId);
    const target = chapterNumber ?? targetCourse?.chapters[0]?.chapterNumber ?? 1;
    router.push(`/study/${courseId}/${target}`);
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#0b1020] text-slate-300">{t("正在打开学习空间…")}</main>;
  }

  if (error || !course || !chapter || (!slides && !study)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b1020] px-6 text-white">
        <div className="text-center"><LanguageSwitcher dark /><h1 className="text-2xl font-semibold">{t("这个存储单元暂时无法打开")}</h1><p className="mt-2 text-slate-400">{t(error || "章节或课件不存在")}</p><Button asChild className="mt-6"><a href="/">{t("返回课程矩阵")}</a></Button></div>
      </main>
    );
  }

  return (
    <main data-edition={mobile ? "mobile" : "desktop"} className="study-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0b1020] text-white">
      <header className="study-header shrink-0 border-b border-white/10 bg-[#0d1326]/92 px-2 py-2 backdrop-blur-xl sm:px-4 lg:px-6">
        {focused ? <div className="mx-auto flex max-w-[1800px] items-center gap-2">
          <Button asChild size="icon" variant="ghost" className="size-11 shrink-0 text-slate-300 hover:bg-white/10 hover:text-white"><a href="/" aria-label={t("返回课程矩阵")}><ArrowLeft /></a></Button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{course.name} · {chapter.chapterNumber === 0 ? t("课程资料") : t("第 {0} 章", {"0":(chapter.chapterNumber)})}</p>
          <LanguageSwitcher dark />
          <Button size="sm" variant="ghost" onClick={() => setFocused(false)} className="min-h-11 shrink-0 text-slate-300 hover:bg-white/10 hover:text-white"><Minimize2 />{t("退出专注")}</Button>
        </div> : <div className="study-header-inner mx-auto grid max-w-[1800px] grid-cols-[44px_minmax(0,1fr)_88px_44px] items-center gap-1 sm:flex sm:flex-wrap sm:gap-3">
          <Button asChild variant="ghost" size="icon" className="size-11 shrink-0 text-slate-300 hover:bg-white/10 hover:text-white"><a href="/" aria-label={t("返回课程矩阵")}><ArrowLeft /></a></Button>
            <div className="study-course-select min-w-0 rounded-xl border border-white/10 bg-white/[.055] sm:w-[min(40vw,300px)]">
              <Select value={course.id} onValueChange={(value) => navigate(value)}>
                <SelectTrigger aria-label={t("选择课程")} className="w-full border-0 bg-transparent px-2 text-sm font-semibold text-white shadow-none data-[size=default]:h-11 sm:px-3 sm:text-base"><BookOpen className="hidden text-blue-400 sm:block" /><SelectValue /></SelectTrigger>
                <SelectContent>{library.courses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="study-chapter-select min-w-0 rounded-xl border border-white/10 bg-white/[.055] sm:w-36">
              <Select value={String(chapter.chapterNumber)} onValueChange={(value) => navigate(course.id, Number(value))}>
                <SelectTrigger aria-label={t("选择章节")} className="w-full border-0 bg-transparent px-2 text-sm font-semibold text-white shadow-none data-[size=default]:h-11 sm:px-3 sm:text-base"><SelectValue /></SelectTrigger>
                <SelectContent>{chapters.map((item) => <SelectItem key={item.id} value={String(item.chapterNumber)}>{item.chapterNumber === 0 ? t("课程资料") : t("第 {0} 章", {"0":(item.chapterNumber)})}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          <Button size="icon" variant="ghost" aria-label={t("专注阅读")} title={t("隐藏选择器，扩大阅读区域")} onClick={() => setFocused(true)} className="size-11 shrink-0 text-slate-300 hover:bg-white/10 hover:text-white"><Maximize2 /></Button>
          <div className="study-view-modes col-span-4 flex w-full rounded-xl border border-white/10 bg-white/[.055] p-1 sm:ml-auto sm:w-auto">
            <LanguageSwitcher dark />
            <Button size="sm" variant="ghost" aria-pressed={mode === "slides"} disabled={!slides} onClick={() => setMode("slides")} className={`min-h-11 flex-1 sm:flex-none ${mode === "slides" ? "bg-white text-slate-950 hover:bg-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Presentation />PPT</Button>
            <Button size="sm" variant="ghost" aria-pressed={mode === "study"} disabled={!study} onClick={() => setMode("study")} className={`min-h-11 flex-1 sm:flex-none ${mode === "study" ? "bg-white text-slate-950 hover:bg-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><FileText />{t("学习文档")}</Button>
            {!mobile && <Button size="sm" variant="ghost" aria-pressed={mode === "split"} disabled={!slides || !study} onClick={() => setMode("split")} className={`desktop-reading-only min-h-11 flex-1 sm:flex-none ${mode === "split" ? "bg-white text-slate-950 hover:bg-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Columns2 />{t("并排")}</Button>}
          </div>
        </div>}
      </header>

      <section className="study-section flex min-h-0 flex-1 flex-col p-2 sm:p-3 lg:p-5">
        {!focused && (slideFiles.length > 1 || studyFiles.length > 1) && (
          <div className="study-file-selectors mx-auto mb-3 flex w-full max-w-[1800px] shrink-0 flex-wrap gap-3">
            {mode !== "study" && slideFiles.length > 1 && <AssetSelect label={t("课件")} value={slides?.id ?? ""} files={slideFiles} onChange={setSelectedSlideId} />}
            {mode !== "slides" && studyFiles.length > 1 && <AssetSelect label={t("学习资料")} value={study?.id ?? ""} files={studyFiles} onChange={setSelectedStudyId} />}
          </div>
        )}
        <div className="mx-auto min-h-0 w-full max-w-[1800px] flex-1 overflow-hidden rounded-[22px] border border-white/10 bg-[#121a30] shadow-2xl">
          {mode === "split" && !mobile && slides && study ? (
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize="60%" minSize="25%">
                <ViewerPane label="PPT" asset={slides}><DocumentViewer asset={slides} variant="dark" /></ViewerPane>
              </ResizablePanel>
              <ResizableHandle withHandle aria-label={t("调整阅读区域宽度")} className="w-3 touch-none bg-white/10 after:w-6" />
              <ResizablePanel defaultSize="40%" minSize="25%">
                <ViewerPane label={t("学习文档")} asset={study}><DocumentViewer asset={study} variant="light" /></ViewerPane>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : mode === "study" && study ? (
            <ViewerPane label={t("学习文档")} asset={study}><DocumentViewer asset={study} variant="light" /></ViewerPane>
          ) : slides ? (
            <ViewerPane label="PPT" asset={slides}><DocumentViewer asset={slides} variant="dark" /></ViewerPane>
          ) : study ? (
            <ViewerPane label={t("学习文档")} asset={study}><DocumentViewer asset={study} variant="light" /></ViewerPane>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function AssetSelect({
  label,
  value,
  files,
  onChange,
}: {
  label: string;
  value: string;
  files: Array<{ id: string; fileName: string }>;
  onChange: (value: string) => void;
}) {
  const t = useT();
  return (
    <div className="study-asset-select min-w-0 basis-full flex-1 rounded-xl border border-white/10 bg-white/[.055] px-3 py-2 sm:basis-64">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={t("选择{0}文件", {"0":(label)})} className="w-full border-0 bg-transparent px-0 text-white shadow-none data-[size=default]:h-11"><SelectValue /></SelectTrigger>
        <SelectContent>{files.map((file) => <SelectItem key={file.id} value={file.id}>{file.fileName}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function ViewerPane({ label, asset, children }: { label: string; asset: LibraryAsset; children: React.ReactNode }) {
  const t = useT();
  return <section aria-label={t("{0}阅读面板", {"0":(label)})} className="flex h-full min-w-0 flex-col"><div className="viewer-label flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 text-xs font-semibold text-slate-400 sm:px-4"><span className="shrink-0">{label}</span><span className="min-w-0 flex-1 truncate font-normal" title={asset.fileName}>{asset.fileName}</span><Button asChild variant="ghost" size="sm" className="min-h-11 shrink-0 px-2 text-slate-300 hover:bg-white/10 hover:text-white"><a href={downloadUrl(asset)} download={asset.fileName} aria-label={t("下载{0}原文件", {"0":(label)})} title={t("下载：{0}", {"0":(asset.fileName)})}><Download />{t("下载")}</a></Button></div><div className="min-h-0 flex-1">{children}</div></section>;
}
