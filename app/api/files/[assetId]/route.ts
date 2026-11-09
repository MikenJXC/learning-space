import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, chapters, courses } from "@/db/schema";
import { json, requireApiUser } from "@/lib/auth";

// Delete only the current account's individual asset, never its chapter/course.
export async function DELETE(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!env.BUCKET) return json({ error: "文件存储暂不可用" }, 503);
  const { assetId } = await params;
  const db = getDb();
  const rows = await db.select({ asset: assets }).from(assets)
    .innerJoin(chapters, eq(assets.chapterId, chapters.id))
    .innerJoin(courses, and(eq(chapters.courseId, courses.id), eq(courses.ownerId, auth.user.userId), isNull(courses.deletedAt)))
    .where(eq(assets.id, assetId)).limit(1);
  const asset = rows[0]?.asset;
  if (!asset) return json({ error: "文件不存在或无权删除" }, 404);
  try {
    // R2 deletion is idempotent. Keep the row until storage succeeds so a
    // storage/DB failure can be retried rather than silently orphaning a file.
    await env.BUCKET.delete(asset.r2Key);
    await db.delete(assets).where(eq(assets.id, asset.id));
    return json({ deleted: asset.id });
  } catch {
    return json({ error: "删除文件失败，请重试" }, 503);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!env.BUCKET) return new Response("Storage unavailable", { status: 503 });

  const { assetId } = await params;
  const db = getDb();
  const rows = await db
    .select({ asset: assets })
    .from(assets)
    .innerJoin(chapters, eq(assets.chapterId, chapters.id))
    .innerJoin(
      courses,
      and(eq(chapters.courseId, courses.id), eq(courses.ownerId, auth.user.userId), isNull(courses.deletedAt)),
    )
    .where(eq(assets.id, assetId))
    .limit(1);

  const asset = rows[0]?.asset;
  if (!asset) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(asset.r2Key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", asset.mimeType);
  headers.set(
    "Content-Disposition",
    `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
  );
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}
