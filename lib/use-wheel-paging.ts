"use client";

import { useEffect, useRef, type RefObject } from "react";

// Each viewer owns its listener. No document-wide wheel handler, so split panes stay independent.
export function useWheelPaging(ref: RefObject<HTMLDivElement | null>, enabled: boolean, page: number, total: number, changePage: (page: number) => void) {
  const current = useRef({ page, total, changePage });
  current.current = { page, total, changePage };
  useEffect(() => {
    const viewport = ref.current;
    if (!viewport || !enabled) return;
    let accumulated = 0;
    let direction = 0;
    let lastEvent = 0;
    let lastTurn = -Infinity;
    function wheel(event: WheelEvent) {
      // Leave browser zoom and horizontal panning untouched.
      if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
      const nextDirection = Math.sign(event.deltaY);
      const now = performance.now();
      if (now - lastEvent > 180 || direction !== nextDirection) accumulated = 0;
      direction = nextDirection;
      lastEvent = now;
      const maximumScroll = viewport!.scrollHeight - viewport!.clientHeight;
      // A zoomed page scrolls naturally first; turn pages only at its top/bottom edge.
      if (maximumScroll > 2 && (nextDirection > 0 ? viewport!.scrollTop < maximumScroll - 2 : viewport!.scrollTop > 2)) {
        accumulated = 0;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (now - lastTurn < 400) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? viewport!.clientHeight : 1);
      accumulated += delta;
      if (Math.abs(accumulated) < 60) return;
      accumulated = 0;
      lastTurn = now;
      const state = current.current;
      const next = Math.max(1, Math.min(state.total, state.page + nextDirection));
      if (next !== state.page) state.changePage(next);
    }
    viewport.addEventListener("wheel", wheel, { passive: false });
    return () => viewport.removeEventListener("wheel", wheel);
  }, [ref, enabled]);
}
