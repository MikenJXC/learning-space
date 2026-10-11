"use client";

import { useEffect, type RefObject } from "react";

// Mouse dragging supplements the scrollbar; touch and keyboard scrolling stay native.
export function useHorizontalDrag(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport || !enabled) return;
    let gesture: { id: number; x: number; y: number; scroll: number; dragging: boolean } | null = null;
    let suppressClickUntil = 0;

    function finish() {
      if (gesture?.dragging) suppressClickUntil = performance.now() + 500;
      const id = gesture?.id;
      gesture = null;
      delete viewport!.dataset.dragging;
      if (id !== undefined && viewport!.hasPointerCapture(id)) viewport!.releasePointerCapture(id);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", finish);
    }

    function start(event: PointerEvent) {
      if (event.pointerType !== "mouse" || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (viewport!.scrollWidth <= viewport!.clientWidth) return;
      if ((event.target as Element).closest("input, textarea, select, [contenteditable='true']")) return;
      // Do not take over native scrollbar thumb dragging.
      const bounds = viewport!.getBoundingClientRect();
      if (event.clientY >= bounds.top + viewport!.clientTop + viewport!.clientHeight) return;
      finish();
      suppressClickUntil = 0;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: viewport!.scrollLeft, dragging: false };
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      window.addEventListener("blur", finish);
    }

    function move(event: PointerEvent) {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (!(event.buttons & 1)) { finish(); return; }
      const distance = event.clientX - gesture.x;
      if (!gesture.dragging) {
        if (Math.abs(distance) < 6 || Math.abs(distance) < Math.abs(event.clientY - gesture.y)) return;
        gesture.dragging = true;
        viewport!.dataset.dragging = "true";
        // Capture only after movement, so a normal click still reaches its link/button.
        viewport!.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      viewport!.scrollLeft = gesture.scroll - distance;
    }

    function end(event: PointerEvent) {
      if (gesture?.id === event.pointerId) finish();
    }

    function click(event: MouseEvent) {
      if (event.detail > 0 && performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClickUntil = 0;
      }
    }

    function nativeDrag(event: DragEvent) {
      if (gesture) event.preventDefault();
    }

    viewport.addEventListener("pointerdown", start);
    viewport.addEventListener("click", click, true);
    viewport.addEventListener("dragstart", nativeDrag);
    return () => {
      finish();
      viewport.removeEventListener("pointerdown", start);
      viewport.removeEventListener("click", click, true);
      viewport.removeEventListener("dragstart", nativeDrag);
    };
  }, [ref, enabled]);
}
