export type AssetKind = "slides" | "study";

export type ReadingProgress = { page: number; totalPages: number; updatedAt: number };

export type LibraryAsset = {
  id: string;
  kind: AssetKind;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  progress?: ReadingProgress | null;
};

export type LibraryChapter = {
  id: string;
  chapterNumber: number;
  assets: LibraryAsset[];
};

export type LibraryCourse = {
  id: string;
  name: string;
  chapters: LibraryChapter[];
};

export type LibraryResponse = { courses: LibraryCourse[] };
