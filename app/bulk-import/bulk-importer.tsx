"use client";
import { LanguageSwitcher, useT } from "@/lib/i18n";

import { useMemo, useState } from "react";
import { ArrowLeft, FolderUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LibraryCourse, LibraryResponse } from "@/lib/library-types";

type QueuedFile = { file: File; course: string; chapter: number; kind: "slides" | "study" };

export function BulkImporter() {
  const t = useT();
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const courseCount = useMemo(() => new Set(files.map((item) => item.course)).size, [files]);

  function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const parsed = selected.flatMap((file) => {
      const parts = file.webkitRelativePath.split("/");
      let course = parts.at(-4);
      let chapterText = parts.at(-3);
      let kind = parts.at(-2);
      let uploadFile = file;
      if (!course || !chapterText || (kind !== "slides" && kind !== "study")) {
        const encoded = file.name.match(/^(.+?)___(\d+)___(slides|study)___(.+)$/);
        if (!encoded) return [];
        course = encoded[1];
        chapterText = encoded[2];
        kind = encoded[3];
        uploadFile = new File([file], encoded[4], { type: file.type, lastModified: file.lastModified });
      }
      if (!course || !chapterText || (kind !== "slides" && kind !== "study")) return [];
      const chapter = Number(chapterText);
      if (!Number.isInteger(chapter) || chapter < 0) return [];
      return [{ file: uploadFile, course, chapter, kind } satisfies QueuedFile];
    });
    setFiles(parsed);
    setDone(false);
    setError(parsed.length === selected.length ? "" : t("有 {0} 个文件未能识别，已跳过。", {"0":(selected.length - parsed.length)}));
  }

  async function importAll() {
    if (!files.length) return;
    setRunning(true);
    setDone(false);
    setError("");
    try {
      const libraryResponse = await fetch("/api/library", { cache: "no-store" });
      const library = (await libraryResponse.json()) as LibraryResponse & { error?: string };
      if (!libraryResponse.ok) throw new Error(library.error || t("读取课程失败"));
      const courses = new Map(library.courses.map((course) => [course.name, course]));

      for (const name of [...new Set(files.map((item) => item.course))]) {
        if (courses.has(name)) continue;
        setProgress(t("正在创建课程：{0}", {"0":(name)}));
        const response = await fetch("/api/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const result = (await response.json()) as { course?: LibraryCourse; error?: string };
        if (!response.ok || !result.course) throw new Error(result.error || t("课程“{0}”创建失败", {"0":(name)}));
        courses.set(name, result.course);
      }

      const groups = new Map<string, QueuedFile[]>();
      for (const item of files) {
        const key = `${item.course}\u0000${item.chapter}`;
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }

      let completed = 0;
      for (const group of groups.values()) {
        const current = group[0];
        const course = courses.get(current.course);
        if (!course) throw new Error(t("找不到课程“{0}”", {"0":(current.course)}));
        setProgress(t("正在上传 {0} · {1}（{2}/{3}）", {"0":(current.course),"1":(current.chapter === 0 ? t("课程资料") : t("第 {0} 章", {"0":(current.chapter)})),"2":(completed + 1),"3":(groups.size)}));
        const form = new FormData();
        form.set("courseId", course.id);
        form.set("chapterNumber", String(current.chapter));
        for (const item of group) form.append(item.kind, item.file, item.file.name);
        const response = await fetch("/api/chapters", { method: "POST", body: form });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || t("上传失败"));
        completed += 1;
      }
      setDone(true);
      setProgress(t("上传完成：{0} 门课程，{1} 份文件。", {"0":(courseCount),"1":(files.length)}));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("批量上传失败"));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-5 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between"><Button asChild variant="ghost"><a href="/"><ArrowLeft />{t("返回课程矩阵")}</a></Button><LanguageSwitcher /></div>
        <section className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,.07)] md:p-10">
          <div className="mb-7 grid size-14 place-items-center rounded-2xl bg-blue-50 text-[#155EEF]"><FolderUp className="size-7" /></div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">{t("批量导入课件")}</h1>
          <p className="mt-3 leading-7 text-slate-500">{t("选择已经按“课程 / 章节 / 类型”整理好的文件夹。导入过程会逐章上传，已有资料不会被删除。")}</p>
          <div className="mt-7 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-5">
            <Input
              type="file"
              multiple
              disabled={running}
              onChange={selectFiles}
              className="h-auto bg-white py-3"
            />
            <p className="mt-3 text-sm text-slate-600">{t("已识别 {0} 门课程、{1} 份文件", {"0": courseCount, "1": files.length})}</p>
          </div>
          {progress && <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{t(progress)}</div>}
          {error && <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(error)}</div>}
          <Button onClick={importAll} disabled={!files.length || running} className="mt-6 w-full bg-[#155EEF] hover:bg-[#0F4FD6]">
            {running ? <><LoaderCircle className="animate-spin" />{t("正在上传")}</> : t("开始批量导入")}
          </Button>
        </section>
      </div>
    </main>
  );
}
