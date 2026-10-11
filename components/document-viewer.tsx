"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileQuestion, LoaderCircle, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryAsset } from "@/lib/library-types";
import { getReadingProgress, saveReadingProgress } from "@/lib/reading-progress";
import type { PPTXPreviewer } from "pptx-preview/dist/previewer/PPTXPreviewer";
import { PdfViewer } from "@/components/pdf-viewer";
import { useWheelPaging } from "@/lib/use-wheel-paging";
import { downloadUrl } from "@/lib/download-url";
import { createSlideImage, getSlideFitScale, repairMissingSlideShapes, SLIDE_FRAME_DOCUMENT, SLIDE_WIDTH } from "@/lib/slide-frame";

export function DocumentViewer({ asset, variant }: { asset: LibraryAsset; variant: "dark" | "light" }) {
  const t = useT();
  const extension = asset.fileName.toLowerCase().split(".").pop();
  if (extension === "pdf") return <PdfViewer key={asset.id} asset={asset} variant={variant} />;
  if (extension === "docx") return <DocxViewer asset={asset} />;
  if (extension === "pptx") return <PptxViewer key={asset.id} asset={asset} />;
  return <Unsupported asset={asset} />;
}

function DocxViewer({ asset }: { asset: LibraryAsset }) {
  const t = useT();
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [response, mammoth] = await Promise.all([fetch(asset.url), import("mammoth")]);
        if (!response.ok) throw new Error(t("文档读取失败"));
        const result = await mammoth.convertToHtml({ arrayBuffer: await response.arrayBuffer() });
        if (!cancelled) setHtml(result.value);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("文档预览失败"));
      }
    })();
    return () => { cancelled = true; };
  }, [asset.url]);

  if (error) return <Unsupported asset={asset} message={error} />;
  if (!html) return <Loading label={t("正在解析 DOCX…")} />;
  const srcDoc = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#eef2f8;color:#182033;font:16px/1.8 ui-sans-serif,system-ui}article{box-sizing:border-box;max-width:860px;min-height:100vh;margin:28px auto;padding:64px 72px;background:#fff;box-shadow:0 16px 45px #13213a1c;border-radius:8px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}td,th{border:1px solid #d9dee8;padding:8px}h1,h2,h3{line-height:1.3}@media(max-width:700px){article{margin:0;padding:28px 22px;border-radius:0}}</style><article>${html}</article>`;
  return <iframe title={asset.fileName} sandbox="" srcDoc={srcDoc} className="h-full w-full border-0 bg-[#eef2f8]" />;
}

function PptxViewer({ asset }: { asset: LibraryAsset }) {
  const t = useT();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameReady, setFrameReady] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<PPTXPreviewer | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [totalPages, setTotalPages] = useState(0);
  const [slideHeight, setSlideHeight] = useState(720);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [manualScale, setManualScale] = useState<number | null>(null);
  const [slideImage, setSlideImage] = useState("");
  const [saveStatus, setSaveStatus] = useState(t("自动记录阅读位置"));
  const saveSequence = useRef(0);
  const baseWidth = SLIDE_WIDTH;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // SSR can finish loading srcdoc before React attaches its onLoad handler.
    const loaded = () => {
      if (frame.contentDocument?.getElementById("slide-root")) setFrameReady(true);
    };
    frame.addEventListener("load", loaded);
    loaded();
    return () => frame.removeEventListener("load", loaded);
  }, []);

  useEffect(() => {
    // A resize may come from device rotation, split view, or browser chrome.
    // Start from a complete page again rather than retaining desktop zoom.
    setManualScale(null);
    viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = frameRef.current?.contentDocument?.getElementById("slide-root");
    if (!frameReady || !host) return;
    let previewer: PPTXPreviewer | null = null;
    void (async () => {
      try {
        const [response, module] = await Promise.all([fetch(asset.url), import("pptx-preview")]);
        if (!response.ok) throw new Error(t("PPT 读取失败"));
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        host.innerHTML = "";
        // Load without the library's fixed-height, internally scrolling slide frame.
        previewer = module.init(host, { width: baseWidth, mode: "list" });
        const deck = await previewer.load(buffer);
        if (cancelled) return;
        if (!deck.slides.length || deck.width <= 0 || deck.height <= 0) throw new Error(t("PPT 中没有可阅读的页面"));
        for (const slide of deck.slides) repairMissingSlideShapes(slide.nodes);
        // Filled text boxes also occur in layout and master layers.
        for (const slide of deck.slides) {
          repairMissingSlideShapes(slide.slideLayout.nodes);
          repairMissingSlideShapes(slide.slideMaster.nodes);
        }
        const height = baseWidth * deck.height / deck.width;
        previewer.wrapper.style.height = `${height}px`;
        previewer.wrapper.style.margin = "0";
        previewer.wrapper.style.overflow = "hidden";
        previewerRef.current = previewer;
        const restoredPage = Math.min(deck.slides.length, getReadingProgress(asset)?.page ?? 1);
        setSlideHeight(height);
        setTotalPages(deck.slides.length);
        setPage(restoredPage);
        setPageInput(String(restoredPage));
        setReady(true);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t("PPT 预览失败"));
      }
    })();
    return () => {
      cancelled = true;
      previewerRef.current = null;
      // The library uses global renderer events; do not destroy other split-view instances.
      host.innerHTML = "";
    };
  }, [asset.id, asset.url, frameReady]);

  useEffect(() => {
    const previewer = previewerRef.current;
    if (!ready || !previewer || !totalPages) return;
    let snapshotFrame = 0;
    let cancelled = false;
    try {
      previewer.renderSingleSlide(page - 1);
      const host = frameRef.current?.contentDocument?.getElementById("slide-root");
      if (!host) throw new Error(t("预览尚未就绪"));
      setSlideImage(createSlideImage(host, slideHeight));
      // The library mounts charts asynchronously. Refresh the inert snapshot
      // after its queued work without letting an old page overwrite a new one.
      snapshotFrame = requestAnimationFrame(() => {
        snapshotFrame = requestAnimationFrame(() => {
          if (!cancelled) setSlideImage(createSlideImage(host, slideHeight));
        });
      });
      viewportRef.current?.scrollTo({ top: 0, left: 0 });
    } catch {
      setError(t("此页预览失败，请下载原文件阅读"));
      return;
    }
    const sequence = ++saveSequence.current;
    setSaveStatus(t("正在保存阅读位置…"));
    void saveReadingProgress(asset.id, { page, totalPages, updatedAt: Date.now() }).then((saved) => {
      if (saveSequence.current === sequence) setSaveStatus(saved ? t("阅读位置已保存") : t("已在本机记录，云端暂未同步"));
    });
    return () => { cancelled = true; cancelAnimationFrame(snapshotFrame); };
  }, [asset.id, page, ready, totalPages, slideHeight]);

  const fitScale = getSlideFitScale(viewport.width, viewport.height, slideHeight);
  const scale = manualScale ?? fitScale;

  function changePage(next: number) {
    const target = Math.max(1, Math.min(totalPages, next));
    setPage(target);
    setPageInput(String(target));
  }

  function jumpToPage() {
    const target = Number(pageInput);
    if (Number.isInteger(target)) changePage(target);
    else setPageInput(String(page));
  }

  useWheelPaging(viewportRef, ready, page, totalPages, changePage);

  if (error) return <Unsupported asset={asset} message={error} />;
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080d19] text-white">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-white/10 bg-[#121a30] px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label={t("上一页")} disabled={!ready || page <= 1} onClick={() => changePage(page - 1)} className="size-11 text-slate-200 hover:bg-white/10 hover:text-white"><ChevronLeft /></Button>
          <label className="flex items-center gap-2 text-sm text-slate-300">{t("第            ")}<input aria-label={t("当前页码")} type="number" min={1} max={totalPages || 1} value={pageInput} disabled={!ready}
              onChange={(event) => setPageInput(event.target.value)} onBlur={jumpToPage}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); jumpToPage(); } }}
              className="h-11 w-14 rounded-lg border border-white/15 bg-white/5 px-1 text-center text-base text-white outline-none focus:border-blue-400" />
            / {totalPages || "—"}{t(" 页          ")}</label>
          <Button variant="ghost" size="icon" aria-label={t("下一页")} disabled={!ready || page >= totalPages} onClick={() => changePage(page + 1)} className="size-11 text-slate-200 hover:bg-white/10 hover:text-white"><ChevronRight /></Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label={t("缩小当前页")} disabled={!ready || scale <= 0.01} onClick={() => setManualScale(Math.max(0.01, scale / 1.2))} className="size-11 text-slate-200 hover:bg-white/10 hover:text-white"><Minus /></Button>
          <span className="min-w-12 text-center text-sm tabular-nums text-slate-300" aria-live="polite">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" aria-label={t("放大当前页")} disabled={!ready || scale >= 3} onClick={() => setManualScale(Math.min(3, scale * 1.2))} className="size-11 text-slate-200 hover:bg-white/10 hover:text-white"><Plus /></Button>
          <Button variant="ghost" size="sm" disabled={!ready} onClick={() => { setManualScale(null); viewportRef.current?.scrollTo({ top: 0, left: 0 }); }} className="min-h-11 px-2 text-slate-200 hover:bg-white/10 hover:text-white"><Maximize />{t("适合窗口")}</Button>
        </div>
      </div>
      <div ref={viewportRef} tabIndex={0} aria-label={t("PPT 页面")} className="relative min-h-0 flex-1 overflow-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" && ready) { event.preventDefault(); changePage(page + 1); }
          if (event.key === "ArrowLeft" && ready) { event.preventDefault(); changePage(page - 1); }
        }}>
        {!ready && <div className="absolute inset-0 z-10"><Loading label={t("正在解析 PPT…")} /></div>}
        <div className="flex min-h-full w-max min-w-full p-4">
          {/* Fit one fixed-layout image; never reflow its text at phone width. */}
          <div className="relative m-auto shrink-0 overflow-hidden" style={{ width: baseWidth * scale, height: slideHeight * scale }}>
            {slideImage && <img src={slideImage} alt={t("{0}，第 {1} 页", {"0":(asset.fileName),"1":(page)})} draggable={false}
              onError={() => setError(t("此页图像预览失败，请下载原文件阅读"))}
              className="block h-full w-full max-w-none select-none" />}
          </div>
        </div>
      </div>
      <iframe ref={frameRef} title={t("PPT 排版引擎")} sandbox="allow-same-origin" srcDoc={SLIDE_FRAME_DOCUMENT}
        onLoad={() => setFrameReady(true)} tabIndex={-1} aria-hidden="true"
        className="pointer-events-none fixed border-0" style={{ left: -20000, top: 0, width: baseWidth, maxWidth: "none", height: slideHeight, visibility: "hidden" }} />
      <div role="status" className="shrink-0 border-t border-white/10 px-4 py-1.5 text-xs text-slate-400">{t(saveStatus)}<span className="hidden sm:inline">{t(" · 滚轮翻页，放大后先滚动当前页")}</span></div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  const t = useT();
  return <div className="grid h-full place-items-center bg-[#0a0f1f] text-sm text-slate-400"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />{label}</span></div>;
}

function Unsupported({ asset, message = "暂时无法在线预览此文件" }: { asset: LibraryAsset; message?: string }) {
  const t = useT();
  return <div className="grid h-full place-items-center bg-[#0a0f1f] px-6 text-center"><div><FileQuestion className="mx-auto size-10 text-slate-500" /><h3 className="mt-4 font-semibold text-white">{t(message)}</h3><p className="mt-2 max-w-md truncate text-sm text-slate-400">{asset.fileName}</p><Button asChild className="mt-5"><a href={downloadUrl(asset)} download={asset.fileName}><Download />{t("下载原文件")}</a></Button></div></div>;
}
