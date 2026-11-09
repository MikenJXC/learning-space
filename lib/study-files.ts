import type { LibraryAsset } from "./library-types";

// Repeated chooser selections append to the queue. Avoid accidental duplicates
// within one submission without merging different files that share a name.
export function mergeUploadFiles<T extends { name: string; size: number; lastModified: number }>(current: T[], incoming: T[]): T[] {
  const result = [...current];
  for (const file of incoming) {
    if (!result.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) result.push(file);
  }
  return result;
}

export function selectReadingAsset(files: LibraryAsset[], selectedId: string) {
  const selected = files.find(file => file.id === selectedId);
  if (selected) return selected;
  return files.reduce<LibraryAsset | undefined>((latest, file) => !latest || (file.progress?.updatedAt ?? 0) > (latest.progress?.updatedAt ?? 0) ? file : latest, undefined);
}
