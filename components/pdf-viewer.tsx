"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, LoaderCircle, Maximize, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import type { LibraryAsset } from "@/lib/library-types";
import { getReadingProgress, saveReadingProgress } from "@/lib/reading-progress";
import { useWheelPaging } from "@/lib/use-wheel-paging";
import { downloadUrl } from "@/lib/download-url";

// Render PDFs ourselves: native embedded PDF readers differ between mobile browsers.
export function PdfViewer({ asset, variant }: { asset: LibraryAsset; variant: "dark" | "light" }) {
  const t = useT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [renderedPage, setRenderedPage] = useState(0);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [total, setTotal] = useState(0);
  const [height, setHeight] = useState(1200);
  const [viewport, setViewport] = useState({width: 0, height: 0});
  const [manualScale, setManualScale] = useState<number | null>(null);
  const [status, setStatus] = useState(t("自动记录阅读位置"));
  const [error, setError] = useState("");
  const width = 900;

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewport({width: entry.contentRect.width, height: entry.contentRect.height}));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    void (async () => {
      try {
        const [response, pdfjs] = await Promise.all([
          fetch(asset.url, {signal: controller.signal}), import("pdfjs-dist"),
        ]);
        if (!response.ok) throw new Error(t("PDF 读取失败"));
        const data = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdfjs.getDocument({data});
        const document = await task.promise;
        if (cancelled) { await document.destroy(); return; }
        documentRef.current = document;
        const restored = Math.min(document.numPages, getReadingProgress(asset)?.page ?? 1);
        setTotal(document.numPages);
        setPage(restored);
        setPageInput(String(restored));
        setLoaded(true);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("PDF 预览失败"));
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      documentRef.current = null;
      void task?.destroy().catch(() => {});
    };
  }, [asset.id, asset.url]);

  useEffect(() => {
    const document = documentRef.current;
    if (!loaded || !document) return;
    let cancelled = false;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    void (async () => {
      try {
        const pdfPage = await document.getPage(page);
        if (cancelled) return;
        const original = pdfPage.getViewport({scale: 1});
        const pageHeight = width * original.height / original.width;
        // Limit backing canvas memory, including when two PDFs are open together.
        const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (width * pageHeight)));
        const renderViewport = pdfPage.getViewport({scale: width / original.width * density});
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${pageHeight}px`;
        canvas.setAttribute("aria-label", t("PDF 第 {0} 页", {"0":(page)}));
        task = pdfPage.render({canvas, viewport: renderViewport});
        await task.promise;
        if (cancelled) return;
        canvasHost.current?.replaceChildren(canvas);
        setHeight(pageHeight);
        setRenderedPage(page);
        viewportRef.current?.scrollTo({top: 0, left: 0});
        setStatus(t("正在保存阅读位置…"));
        const saved = await saveReadingProgress(asset.id, {page, totalPages: document.numPages, updatedAt: Date.now()});
        if (!cancelled) setStatus(saved ? t("阅读位置已保存") : t("已在本机记录，云端暂未同步"));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("PDF 页面预览失败"));
      }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [asset.id, loaded, page]);

  const scale = manualScale ?? (viewport.width && viewport.height
    ? Math.max(0.01, Math.min((viewport.width - 32) / width, (viewport.height - 32) / height)) : 1);
  const ready = loaded && renderedPage === page;
  function changePage(next: number) {
    const target = Math.max(1, Math.min(total, next));
    setPage(target); setPageInput(String(target));
  }
  function jump() {
    const target = Number(pageInput);
    if (Number.isInteger(target)) changePage(target);
    else setPageInput(String(page));
  }

  useWheelPaging(viewportRef, loaded, page, total, (next) => { if (ready) changePage(next); });

  if (error) return <div className="grid h-full place-items-center px-4 text-center text-slate-300"><div><p>{t(error)}</p><Button asChild className="mt-4"><a href={downloadUrl(asset)} download={asset.fileName}><Download />{t("下载原文件")}</a></Button></div></div>;
  return <div className={`flex h-full min-h-0 flex-col text-white ${variant === "light" ? "bg-[#dce3ed]" : "bg-[#080d19]"}`}>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-white/10 bg-[#121a30] px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" aria-label={t("上一页")} disabled={!ready || page <= 1} onClick={() => changePage(page - 1)} className="size-11 text-slate-200 hover:bg-white/10 hover:text-white"><ChevronLeft /></Button>
        <label className="flex items-center gap-2 text-sm text-slate-300">{t("第 ")}<input aria-label={t("当前页码")} type="number" min={1} max={total || 1} disabled={!ready} value={pageInput} onChange={e => setPageInput(e.target.value)} onBlur={jump} onKeyDown={e => {if (e.key === "Enter") {e.preventDefault(); jump();}}} className="h-11 w-14 rounded-lg border border-white/15 bg-white/5 px-1 text-center text-base text-white outline-none focus:border-blue-400" /> / {total || "—"}{t(" 页")}</label>
        <Button variant="ghost" size="icon" aria-label={t("下一页")} disabled={!ready || page >= total} onClick={() => changePage(page + 1)} className="size-11 text-slate-200 hover:bg-white/10 hover:text-white"><ChevronRight /></Button>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" aria-label={t("缩小当前页")} disabled={!ready || scale <= 0.1} onClick={() => setManualScale(Math.max(0.1, scale - 0.1))} className="size-11 text-slate-200 hover:bg-white/10 hover:text-white"><Minus /></Button>
        <span className="min-w-12 text-center text-sm tabular-nums text-slate-300" aria-live="polite">{Math.round(scale * 100)}%</span>
        <Button variant="ghost" size="icon" aria-label={t("放大当前页")} disabled={!ready || scale >= 3} onClick={() => setManualScale(Math.min(3, scale + 0.1))} className="size-11 text-slate-200 hover:bg-white/10 hover:text-white"><Plus /></Button>
        <Button variant="ghost" size="sm" disabled={!ready} onClick={() => {setManualScale(null); viewportRef.current?.scrollTo({top: 0, left: 0});}} className="min-h-11 px-2 text-slate-200 hover:bg-white/10 hover:text-white"><Maximize />{t("适合窗口")}</Button>
      </div>
    </div>
    <div ref={viewportRef} tabIndex={0} aria-label={t("PDF 页面")} className="relative min-h-0 flex-1 overflow-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400" onKeyDown={e => {if (ready && e.key === "ArrowRight") {e.preventDefault(); changePage(page+1);} if (ready && e.key === "ArrowLeft") {e.preventDefault(); changePage(page-1);}}}>
      {!ready && <div className="absolute inset-0 z-10 grid place-items-center bg-[#0a0f1f] text-sm text-slate-400"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />{t("正在解析 PDF…")}</span></div>}
      <div className="flex min-h-full w-max min-w-full p-4"><div className="relative m-auto shrink-0" style={{width:width*scale,height:height*scale}}><div ref={canvasHost} className="pdf-stage absolute left-0 top-0 origin-top-left bg-white" style={{width,height,transform:`scale(${scale})`,visibility:ready?"visible":"hidden"}} /></div></div>
    </div>
    <div role="status" className="shrink-0 border-t border-white/10 bg-[#080d19] px-4 py-1.5 text-xs text-slate-400">{t(status)}</div>
  </div>;
}
