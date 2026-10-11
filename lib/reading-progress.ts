import type { LibraryAsset, ReadingProgress } from "./library-types";

const prefix = "learning-reading:";

export function getReadingProgress(asset: LibraryAsset): ReadingProgress | null {
  let cached: ReadingProgress | null = null;
  try {
    const value = JSON.parse(localStorage.getItem(prefix + asset.id) ?? "null");
    if (value && Number.isInteger(value.page) && Number.isInteger(value.totalPages) && value.page > 0 &&
        value.page <= value.totalPages && Number.isSafeInteger(value.updatedAt)) cached = value;
  } catch { /* Browser storage may be unavailable; the server copy still works. */ }
  return cached && cached.updatedAt > (asset.progress?.updatedAt ?? 0) ? cached : asset.progress ?? null;
}

export async function saveReadingProgress(assetId: string, progress: ReadingProgress): Promise<boolean> {
  try { localStorage.setItem(prefix + assetId, JSON.stringify(progress)); } catch { /* Optional local backup. */ }
  try {
    const response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, ...progress }),
      keepalive: true,
    });
    return response.ok;
  } catch { return false; }
}
