import { and, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, chapters, courses } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json() as { assetId?: string; page?: number; totalPages?: number; updatedAt?: number };
    const { assetId, page, totalPages, updatedAt } = body;
    if (typeof assetId !== "string" || typeof page !== "number" || typeof totalPages !== "number" || typeof updatedAt !== "number" ||
        !Number.isInteger(page) || !Number.isInteger(totalPages) || !Number.isSafeInteger(updatedAt) ||
        page < 1 || page > totalPages || totalPages > 100000 || updatedAt < 1 || updatedAt > Date.now() + 60000) {
      return Response.json({ error: "阅读位置无效" }, { status: 400 });
    }
    const db = getDb();
    const owned = await db.select({ id: assets.id }).from(assets)
      .innerJoin(chapters, eq(assets.chapterId, chapters.id))
      .innerJoin(courses, eq(chapters.courseId, courses.id))
      .where(and(eq(assets.id, assetId), eq(courses.ownerId, auth.user.userId), isNull(courses.deletedAt))).limit(1);
    if (!owned[0]) return Response.json({ error: "文件不存在" }, { status: 404 });

    // A slower earlier request must not overwrite a more recent page change.
    await db.update(assets).set({ readingPage: page, readingTotal: totalPages, readingUpdatedAt: updatedAt })
      .where(and(eq(assets.id, assetId), or(isNull(assets.readingUpdatedAt), lte(assets.readingUpdatedAt, updatedAt))));
    return Response.json({ saved: true });
  } catch {
    return Response.json({ error: "阅读位置保存失败" }, { status: 400 });
  }
}
