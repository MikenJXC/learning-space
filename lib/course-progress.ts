import type { LibraryChapter, LibraryCourse } from "./library-types";

export function courseProgress(course: Pick<LibraryCourse, "progressBasis">, chapter?: LibraryChapter) {
  const basis = course.progressBasis === "study" ? "study" : "slides";
  const files = chapter?.assets.filter(asset => asset.kind === basis) ?? [];
  const lastRead = [...files].filter(asset => asset.progress)
    .sort((a, b) => (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0))[0];
  return { basis, files, lastRead, progress: lastRead?.progress ?? null };
}

export function readingPercent(page: number, totalPages: number, fileName: string) {
  return Math.round(Math.min(100, Math.max(0, fileName.toLowerCase().endsWith(".docx")
    ? (page - 1) / Math.max(1, totalPages - 1) * 100 : page / totalPages * 100)));
}
