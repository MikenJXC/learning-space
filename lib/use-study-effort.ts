"use client";
import { useEffect, useRef, useState } from "react";
import { addActiveInterval, EFFORT_BUCKET_MS, EFFORT_IDLE_MS, EFFORT_WINDOW_MS, type EffortTick } from "./study-effort";

export function useStudyEffort(courseId: string, chapter: number, visibleAssetIds: string[]) {
  const visible = useRef(visibleAssetIds);
  visible.current = visibleAssetIds;
  const wake = useRef(() => {});
  const [status, setStatus] = useState<"reading" | "paused" | "loading" | "offline">("loading");
  useEffect(() => {
    const sessionId = crypto.randomUUID(), queue = new Map<number, EffortTick>(), acknowledged = new Map<number, number>();
    const ready = new Set<string>();
    let lastInteraction = Date.now(), lastSample = Date.now(), activeAsset = "", sending = false, disposed = false, failed = false;
    wake.current = () => { lastInteraction = Date.now(); };
    const interact = (event: Event) => {
      lastInteraction = Date.now();
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-study-asset]") : null;
      if (target?.dataset.studyAsset && visible.current.includes(target.dataset.studyAsset)) activeAsset = target.dataset.studyAsset;
    };
    const rendered = (event: Event) => { const id = (event as CustomEvent<{ assetId: string }>).detail?.assetId; if (id) ready.add(id); };
    const sample = () => {
      const now = Date.now();
      if (!visible.current.includes(activeAsset)) activeAsset = visible.current[0] ?? "";
      const available = ready.has(activeAsset);
      const active = available && document.visibilityState === "visible" && document.hasFocus() && now - lastInteraction < EFFORT_IDLE_MS;
      if (active) addActiveInterval(queue, lastSample, now, activeAsset);
      lastSample = now;
      if (!disposed) setStatus(!available ? "loading" : failed ? "offline" : active ? "reading" : "paused");
    };
    const flush = async () => {
      if (sending) return;
      const now = Date.now();
      for (const [bucket, tick] of queue) {
        if (bucket < now - EFFORT_WINDOW_MS + EFFORT_BUCKET_MS || (bucket + EFFORT_BUCKET_MS < now && acknowledged.get(bucket) === tick.activeMs)) {
          queue.delete(bucket); acknowledged.delete(bucket);
        }
      }
      const ticks = [...queue.values()].filter(t => acknowledged.get(t.bucketStart) !== t.activeMs).map(t => ({ ...t }));
      if (!ticks.length) return;
      sending = true;
      try {
        const response = await fetch("/api/effort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId, ticks }), keepalive: true });
        failed = !response.ok;
        if (response.ok) for (const tick of ticks) acknowledged.set(tick.bucketStart, tick.activeMs);
      } catch { failed = true; }
      finally { sending = false; }
    };
    const suspend = () => { sample(); void flush(); lastSample = Date.now(); };
    const focus = () => { lastSample = Date.now(); lastInteraction = Date.now(); };
    const events = ["pointerdown", "pointermove", "wheel", "keydown", "touchstart", "scroll"];
    for (const event of events) document.addEventListener(event, interact, { capture: true, passive: true });
    window.addEventListener("learning-reading-ready", rendered);
    document.addEventListener("visibilitychange", suspend);
    window.addEventListener("blur", suspend);
    window.addEventListener("focus", focus);
    window.addEventListener("pagehide", suspend);
    const clock = window.setInterval(sample, 1000), sync = window.setInterval(() => void flush(), 15000);
    return () => {
      sample(); disposed = true; void flush();
      clearInterval(clock); clearInterval(sync);
      for (const event of events) document.removeEventListener(event, interact, true);
      window.removeEventListener("learning-reading-ready", rendered);
      document.removeEventListener("visibilitychange", suspend);
      window.removeEventListener("blur", suspend);
      window.removeEventListener("focus", focus);
      window.removeEventListener("pagehide", suspend);
    };
  }, [courseId, chapter]);
  return { status, resume: () => wake.current() };
}
