"use client";
import { useT } from "@/lib/i18n";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookOpen, ChevronLeft, ChevronRight, FileText, Grid3X3, Plus, Presentation, RotateCcw, Trash2, Upload } from "lucide-react";
import { AccountActions } from "@/components/account-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LibraryCourse, LibraryResponse } from "@/lib/library-types";
import { getReadingProgress } from "@/lib/reading-progress";
import { useMobileEdition } from "@/lib/use-mobile-edition";
import { useHorizontalDrag } from "@/lib/use-horizontal-drag";

type Props = { displayName: string };

export function LibraryApp({ displayName }: Props) {
  const t = useT();
  const mobile = useMobileEdition();
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [saving, setSaving] = useState(false);
  const [chapterStart, setChapterStart] = useState(1);
  const [chapterJump, setChapterJump] = useState("1");
  const [deletingCourse, setDeletingCourse] = useState<LibraryCourse | null>(null);
  const [deletedDialogOpen, setDeletedDialogOpen] = useState(false);
  const [deletedCourses, setDeletedCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const matrixRef = useRef<HTMLDivElement>(null);
  useHorizontalDrag(matrixRef, !loading && courses.length > 0);

  const loadLibrary = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/library", { cache: "no-store" });
      const data = (await response.json()) as LibraryResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || t("课件库读取失败"));
      setCourses(data.courses.map((course) => ({ ...course, chapters: course.chapters.map((chapter) => ({
        ...chapter, assets: chapter.assets.map((asset) => ({ ...asset, progress: getReadingProgress(asset) })),
      })) })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("课件库读取失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const maxChapter = useMemo(
    () => courses.reduce((maximum, course) => course.chapters.reduce((last, chapter) => Math.max(last, chapter.chapterNumber), maximum), 6),
    [courses],
  );
  // Bound DOM size without putting a limit on each course's chapter numbers.
  const rangeSize = 12;
  const visibleStart = Math.min(chapterStart, Math.floor((maxChapter - 1) / rangeSize) * rangeSize + 1);
  const visibleEnd = Math.min(maxChapter, visibleStart + rangeSize - 1);
  const columns = [0, ...Array.from({ length: visibleEnd - visibleStart + 1 }, (_, index) => visibleStart + index)];
  const editingChapter = courses
    .find((course) => course.id === courseId)
    ?.chapters.find((chapter) => chapter.chapterNumber === chapterNumber);

  function openUpload(nextCourseId?: string, nextChapter?: number) {
    if (!courses.length) {
      setCourseDialogOpen(true);
      return;
    }
    setCourseId(nextCourseId || courses[0].id);
    setChapterNumber(nextChapter ?? 1);
    setUploadDialogOpen(true);
  }

  function addChapter(course: LibraryCourse) {
    const next = Math.max(0, ...course.chapters.map((chapter) => chapter.chapterNumber)) + 1;
    openUpload(course.id, next);
  }

  async function openDeletedCourses() {
    setDeletedDialogOpen(true);
    setDeletedLoading(true);
    setError("");
    try {
      const response = await fetch("/api/courses", { cache: "no-store" });
      const data = await response.json() as { courses: Array<{ id: string; name: string }>; error?: string };
      if (!response.ok) throw new Error(data.error || t("已删除课程读取失败"));
      setDeletedCourses(data.courses);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("读取失败")); }
    finally { setDeletedLoading(false); }
  }

  async function changeCourseVisibility(course: { id: string; name: string }, deleted: boolean) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/courses/${course.id}`, { method: deleted ? "DELETE" : "POST" });
      const data = await response.json() as { saved?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || (deleted ? t("删除失败") : t("恢复失败")));
      if (deleted) setDeletingCourse(null);
      else setDeletedCourses((items) => items.filter((item) => item.id !== course.id));
      await loadLibrary();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("操作失败")); }
    finally { setSaving(false); }
  }

  function jumpChapters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = Number(chapterJump);
    if (!Number.isSafeInteger(target) || target < 1) return;
    const clamped = Math.min(maxChapter, target);
    setChapterStart(Math.floor((clamped - 1) / rangeSize) * rangeSize + 1);
    setChapterJump(String(clamped));
  }

  async function createCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: courseName }),
      });
      const data = (await response.json()) as { course?: LibraryCourse; error?: string };
      if (!response.ok || !data.course) throw new Error(data.error || t("课程创建失败"));
      setCourseDialogOpen(false);
      setCourseName("");
      await loadLibrary();
      setCourseId(data.course.id);
      setChapterNumber(1);
      setUploadDialogOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("课程创建失败"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadChapter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isSafeInteger(chapterNumber) || chapterNumber < 0) { setError(t("请输入有效的非负整数章节编号")); return; }
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("courseId", courseId);
    data.set("chapterNumber", String(chapterNumber));
    data.set("createEmptyChapter", "true");
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/chapters", { method: "POST", body: data });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || t("上传失败"));
      setUploadDialogOpen(false);
      form.reset();
      await loadLibrary();
      if (chapterNumber > 0) setChapterStart(Math.floor((chapterNumber - 1) / rangeSize) * rangeSize + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("上传失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main data-edition={mobile ? "mobile" : "desktop"} className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-2 px-3 py-2 sm:min-h-[72px] sm:px-5 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#155EEF] text-white shadow-[0_8px_22px_rgba(21,94,239,.24)]"><BookOpen className="size-5" /></div>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold tracking-[-0.02em]">{t("学习空间")}</p>
              <p className="truncate text-xs text-slate-500">{t("课程 × 章节课件库 · ")}{mobile ? t("手机版") : t("电脑版")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-slate-500 md:block">{displayName}</span>
            <AccountActions />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-3 py-5 sm:px-5 sm:py-8 lg:px-10 lg:py-10">
        <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#155EEF]"><Grid3X3 className="size-4" />{t("课程矩阵")}</div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl md:text-4xl">{t("从课程定位到每一章")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">{t("每一行是一门课程，每一列是对应章节。点击已有单元格开始阅读，点击空白单元格直接上传。")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 flex-1 sm:flex-none" variant="outline" onClick={() => setCourseDialogOpen(true)}><Plus />{t("新建课程")}</Button>
            <Button className="min-h-11 flex-1 bg-[#155EEF] hover:bg-[#0F4FD6] sm:flex-none" onClick={() => openUpload()}><Upload />{t("上传章节")}</Button>
            <Button className="min-h-11 flex-1 sm:flex-none" variant="ghost" onClick={() => void openDeletedCourses()}><RotateCcw />{t("已删除课程")}</Button>
          </div>
        </div>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t(error)}</div>}

        {!loading && courses.length > 0 && <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p id="matrix-hint" className="text-xs text-slate-500">{t("鼠标按住矩阵左右拖拽，或使用底部滚动条；手机可左右滑动。点击“增加章节”可继续添加。")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" className="size-11" aria-label={t("上一组章节")} disabled={visibleStart === 1} onClick={() => setChapterStart(visibleStart - rangeSize)}><ChevronLeft /></Button>
            <span className="text-xs text-slate-500">{t("第 {0}–{1} 章 · 最高 {2} 章", {"0":visibleStart,"1":visibleEnd,"2":maxChapter})}</span>
            <Button variant="outline" size="icon" className="size-11" aria-label={t("下一组章节")} disabled={visibleEnd >= maxChapter} onClick={() => setChapterStart(visibleStart + rangeSize)}><ChevronRight /></Button>
            <form onSubmit={jumpChapters} className="flex items-center gap-2"><Input aria-label={t("跳转到章节")} type="number" required min={1} step={1} value={chapterJump} onChange={event => setChapterJump(event.target.value)} className="h-11 w-20" /><Button type="submit" variant="outline" className="min-h-11">{t("跳转")}</Button></form>
          </div>
        </div>}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,.07)] sm:rounded-[26px]">
          {loading ? (
            <div className="grid min-h-[360px] place-items-center text-slate-500">{t("正在整理课件库…")}</div>
          ) : courses.length === 0 ? (
            <div className="grid min-h-[420px] place-items-center px-6 text-center">
              <div>
                <div className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-blue-50 text-[#155EEF]"><BookOpen className="size-7" /></div>
                <h2 className="text-xl font-semibold">{t("先创建第一门课程")}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{t("例如“数据库原理”。创建后即可把第一章的 PPT 和可选学习文档放进对应单元格。")}</p>
                <Button className="mt-6 bg-[#155EEF] hover:bg-[#0F4FD6]" onClick={() => setCourseDialogOpen(true)}><Plus />{t("创建课程")}</Button>
              </div>
            </div>
          ) : (
            <div ref={matrixRef} className="matrix-scroll overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#155EEF]" role="region" aria-label={t("课程章节矩阵")} aria-describedby="matrix-hint" tabIndex={0}>
              <table className="course-matrix table-fixed border-separate border-spacing-0" style={{ "--chapter-count": columns.length } as CSSProperties}>
                <colgroup><col className="matrix-course-column" />{columns.map((number) => <col key={number} className="matrix-chapter-column" />)}</colgroup>
                <thead><tr>
                  <th scope="col" className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-3 py-4 text-left text-sm font-semibold text-slate-600 sm:px-6">{t("课程名称")}</th>
                  {columns.map((number) => <th key={number} scope="col" className="border-b border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-semibold text-slate-600">{number === 0 ? t("课程资料") : t("第 {0} 章", {"0":(number)})}</th>)}
                </tr></thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id}>
                      <th scope="row" className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-5 text-left sm:px-6">
                        <span className="block break-words text-sm font-semibold sm:text-[15px]" title={course.name}>{course.name}</span>
                        <span className="mt-1 block text-xs font-normal text-slate-400">{course.chapters.filter((item) => item.chapterNumber > 0).length}{t(" 个章节")}</span>
                        <button type="button" aria-label={t("为{0}增加章节", {"0":(course.name)})} onClick={() => addChapter(course)} className="mt-2 flex min-h-11 w-full items-center gap-1 rounded-lg text-xs font-normal text-[#155EEF] hover:bg-blue-50"><Plus className="size-3.5 shrink-0" />{t("增加章节")}</button>
                        <button type="button" aria-label={t("删除课程{0}", {"0":(course.name)})} onClick={() => { setError(""); setDeletingCourse(course); }} className="flex min-h-11 w-full items-center gap-1 rounded-lg text-xs font-normal text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-3.5 shrink-0" />{t("删除课程")}</button>
                      </th>
                      {columns.map((number) => {
                        const chapter = course.chapters.find((item) => item.chapterNumber === number);
                        const slideFiles = chapter?.assets.filter((asset) => asset.kind === "slides") ?? [];
                        const studyFiles = chapter?.assets.filter((asset) => asset.kind === "study") ?? [];
                        const firstFile = slideFiles[0] ?? studyFiles[0];
                        const lastRead = chapter?.assets.filter((asset) => asset.progress)
                          .sort((a, b) => (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0))[0];
                        const progress = lastRead?.progress;
                        return (
                          <td key={number} className="border-b border-slate-200 p-2 align-middle sm:p-3">
                            {chapter && firstFile ? (
                              <div className="group min-h-24 rounded-2xl border border-blue-100 bg-blue-50/65 p-3 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md">
                                <a href={`/study/${course.id}/${number}`} className="block rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]">
                                  <div className="mb-2 flex items-center justify-between"><Presentation className="size-5 text-[#155EEF]" /><span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-500">{t("可阅读")}</span></div>
                                  <p className="truncate text-sm font-semibold" title={firstFile.fileName}>{firstFile.fileName}</p>
                                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><FileText className="size-3" />{slideFiles.length + studyFiles.length}{t(" 份文件")}</p>
                                  {progress ? <div className="mt-3" title={t("上次阅读：{0}", {"0":(lastRead?.fileName)})}>
                                    <p className="text-xs font-medium text-[#155EEF]">{t("读到第 {0} / {1} 页", {"0":progress.page,"1":progress.totalPages})}</p>
                                    {chapter.assets.length > 1 && <p className="mt-1 truncate text-[11px] text-slate-500">{lastRead?.fileName}</p>}
                                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-[#155EEF]" style={{ width: `${Math.min(100, progress.page / progress.totalPages * 100)}%` }} /></div>
                                  </div> : <p className="mt-2 text-xs text-slate-400">{t("尚未阅读")}</p>}
                                </a>
                                <button type="button" onClick={() => openUpload(course.id, number)} className="mt-2 min-h-11 w-full rounded-lg px-2 py-2 text-xs font-medium text-[#155EEF] hover:bg-white">{t("更新资料")}</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => openUpload(course.id, number)} className="group grid min-h-24 w-full place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-400 transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-[#155EEF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155EEF]">
                                <span className="flex flex-col items-center gap-2 text-xs font-medium"><Plus className="size-5" />{chapter ? t("已建章节 · 添加课件") : t("添加课件")}</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!deletingCourse} onOpenChange={open => { if (!open && !saving) setDeletingCourse(null); }}>
        <DialogContent className="rounded-3xl sm:max-w-md"><DialogHeader><DialogTitle>{t("删除课程“{0}”？", {"0":deletingCourse?.name ?? ""})}</DialogTitle><DialogDescription>{t("这门课及其章节将从课程矩阵移除。原文件和阅读位置会保留，可以通过“已删除课程”恢复。")}</DialogDescription></DialogHeader>
          {error && <p role="alert" className="text-sm text-red-600">{t(error)}</p>}
          <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDeletingCourse(null)}>{t("取消")}</Button><Button variant="destructive" disabled={saving} onClick={() => deletingCourse && void changeCourseVisibility(deletingCourse, true)}>{saving ? t("删除中…") : t("确认删除课程")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletedDialogOpen} onOpenChange={open => { if (!saving) setDeletedDialogOpen(open); }}>
        <DialogContent className="rounded-3xl sm:max-w-lg"><DialogHeader><DialogTitle>{t("已删除课程")}</DialogTitle><DialogDescription>{t("恢复后，章节、原文件和阅读位置会一并回到矩阵。")}</DialogDescription></DialogHeader>
          {error && <p role="alert" className="text-sm text-red-600">{t(error)}</p>}
          {deletedLoading ? <p className="py-6 text-sm text-slate-500">{t("正在读取…")}</p> : deletedCourses.length === 0 ? <p className="py-6 text-sm text-slate-500">{t("暂无已删除课程")}</p> : <ul className="grid gap-2">{deletedCourses.map(course => <li key={course.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><span className="min-w-0 break-words text-sm">{course.name}</span><Button disabled={saving} variant="outline" className="min-h-11 shrink-0" onClick={() => void changeCourseVisibility(course, false)}><RotateCcw />{t("恢复")}</Button></li>)}</ul>}
        </DialogContent>
      </Dialog>

      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md"><form onSubmit={createCourse}>
          <DialogHeader><DialogTitle>{t("新建课程")}</DialogTitle><DialogDescription>{t("课程将作为矩阵中的一整行。")}</DialogDescription></DialogHeader>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{t(error)}</p>}
          <div className="my-6 grid gap-2"><Label htmlFor="course-name">{t("课程名称")}</Label><Input id="course-name" value={courseName} onChange={(event) => setCourseName(event.target.value)} placeholder={t("例如：数据库原理")} autoFocus /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setCourseDialogOpen(false)}>{t("取消")}</Button><Button type="submit" disabled={saving || !courseName.trim()} className="bg-[#155EEF] hover:bg-[#0F4FD6]">{saving ? t("创建中…") : t("创建并上传")}</Button></DialogFooter>
        </form></DialogContent>
      </Dialog>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-xl"><form onSubmit={uploadChapter}>
          <DialogHeader><DialogTitle>{editingChapter ? t("补充章节资料") : t("增加章节 / 上传资料")}</DialogTitle><DialogDescription>{t("章节编号可继续增加，例如 10、20；不选文件也可先创建空章节。同一栏可上传多份 PDF、PPTX、DOCX，现有文件会保留。")}</DialogDescription></DialogHeader>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{t(error)}</p>}
          <div className="my-6 grid gap-5">
            <div className="grid gap-2"><Label>{t("课程")}</Label><Select value={courseId} onValueChange={setCourseId}><SelectTrigger className="w-full"><SelectValue placeholder={t("选择课程")} /></SelectTrigger><SelectContent>{courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label htmlFor="chapter-number">{t("章节（0 代表课程资料，无固定章数上限）")}</Label><Input id="chapter-number" type="number" required min={0} step={1} value={chapterNumber} onChange={(event) => setChapterNumber(Number(event.target.value))} /></div>
            <div className="grid gap-2"><Label htmlFor="slides-file">{t("PPT / 课件")}</Label><Input id="slides-file" name="slides" type="file" accept=".pdf,.pptx,.docx" multiple className="h-auto py-2.5" /></div>
            <div className="grid gap-2"><Label htmlFor="study-file">{t("学习文档 / 补充资料（可选）")}</Label><Input id="study-file" name="study" type="file" accept=".pdf,.pptx,.docx" multiple className="h-auto py-2.5" /></div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>{t("取消")}</Button><Button type="submit" disabled={saving || !courseId} className="bg-[#155EEF] hover:bg-[#0F4FD6]">{saving ? t("上传中…") : t("保存到矩阵")}</Button></DialogFooter>
        </form></DialogContent>
      </Dialog>
    </main>
  );
}
