import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, chapters, courses } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import type { LibraryCourse } from "@/lib/library-types";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const db = getDb();
  const courseRows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.ownerId, auth.user.userId), isNull(courses.deletedAt)))
    .orderBy(asc(courses.createdAt), asc(courses.name));

  if (!courseRows.length) return Response.json({ courses: [] });

  const chapterRows = await db
    .select()
    .from(chapters)
    .where(inArray(chapters.courseId, courseRows.map((course) => course.id)))
    .orderBy(asc(chapters.chapterNumber));

  const assetRows = chapterRows.length
    ? await db
        .select()
        .from(assets)
        .where(inArray(assets.chapterId, chapterRows.map((chapter) => chapter.id)))
        .orderBy(asc(assets.kind))
    : [];

  const result: LibraryCourse[] = courseRows.map((course) => ({
    id: course.id,
    name: course.name,
    chapters: chapterRows
      .filter((chapter) => chapter.courseId === course.id)
      .map((chapter) => ({
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        assets: assetRows
          .filter((asset) => asset.chapterId === chapter.id)
          .map((asset) => ({
            id: asset.id,
            kind: asset.kind,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            size: asset.size,
            url: `/api/files/${asset.id}`,
            progress: asset.readingPage && asset.readingTotal && asset.readingUpdatedAt
              ? { page: asset.readingPage, totalPages: asset.readingTotal, updatedAt: asset.readingUpdatedAt }
              : null,
          })),
      })),
  }));

  return Response.json({ courses: result });
}
