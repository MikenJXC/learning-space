export const EFFORT_BUCKET_MS = 15000;
export const EFFORT_IDLE_MS = 120000;
export const EFFORT_WINDOW_MS = 600000;
export const EFFORT_MIN_SESSION_MS = 10000;
export type EffortTick = { bucketStart: number; activeMs: number; assetId: string };

export function addActiveInterval(queue: Map<number, EffortTick>, start: number, end: number, assetId: string) {
  if (end <= start || end - start > 2000) return;
  for (let cursor = start; cursor < end;) {
    const bucketStart = Math.floor(cursor / EFFORT_BUCKET_MS) * EFFORT_BUCKET_MS;
    const until = Math.min(end, bucketStart + EFFORT_BUCKET_MS);
    const old = queue.get(bucketStart);
    queue.set(bucketStart, { bucketStart, activeMs: Math.min(EFFORT_BUCKET_MS, (old?.activeMs ?? 0) + until - cursor), assetId: old?.assetId ?? assetId });
    cursor = until;
  }
}

export function validEffortTicks(input: unknown, now: number): EffortTick[] | null {
  if (!Array.isArray(input) || !input.length || input.length > 40) return null;
  const unique = new Set<number>();
  const result: EffortTick[] = [];
  for (const tick of input) {
    if (!tick || !Number.isSafeInteger(tick.bucketStart) || tick.bucketStart % EFFORT_BUCKET_MS !== 0 ||
      tick.bucketStart < now - EFFORT_WINDOW_MS || tick.bucketStart > now ||
      !Number.isSafeInteger(tick.activeMs) || tick.activeMs < 1 || tick.activeMs > Math.min(EFFORT_BUCKET_MS, now - tick.bucketStart) ||
      typeof tick.assetId !== "string" || tick.assetId.length > 64 || !tick.assetId || unique.has(tick.bucketStart)) return null;
    unique.add(tick.bucketStart); result.push({ bucketStart: tick.bucketStart, activeMs: tick.activeMs, assetId: tick.assetId });
  }
  return result;
}

export function effortRangeStart(now: number, days: number, offset: number) {
  const shifted = new Date(now + offset * 60000);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - days + 1) - offset * 60000;
}
export function dayKey(time: number, offset: number) { return new Date(time + offset * 60000).toISOString().slice(0, 10); }
export function effortDays(now: number, days: number, offset: number, daily: Array<{ date: string; activeMs: number }>) {
  const first = effortRangeStart(now, days, offset);
  const values = new Map(daily.map(item => [item.date, Number(item.activeMs)]));
  return Array.from({ length: days }, (_, i) => { const date = dayKey(first + i * 86400000, offset); return { date, activeMs: values.get(date) ?? 0 }; });
}
export function effortStreak(daily: Array<{ date: string; activeMs: number }>, today: string) {
  const active = new Set(daily.filter(d => d.activeMs >= EFFORT_MIN_SESSION_MS).map(d => d.date));
  const todayUtc = Date.parse(today + "T00:00:00Z");
  let cursor = active.has(today) ? todayUtc : todayUtc - 86400000;
  let streak = 0;
  while (active.has(new Date(cursor).toISOString().slice(0, 10))) { streak++; cursor -= 86400000; }
  return streak;
}

export type EffortSummary = {
  days: number; offset: number; generatedAt: number; firstRecordedAt: number | null;
  activeMs: number; lifetimeMs: number; sessions: number;
  daily: Array<{ date: string; activeMs: number }>;
  hours: Array<{ hour: number; activeMs: number }>;
  courses: Array<{ courseId: string; activeMs: number }>;
  recent: Array<{ id: string; courseId: string; courseName: string; chapterNumber: number; startedAt: number; lastAt: number; activeMs: number }>;
};
