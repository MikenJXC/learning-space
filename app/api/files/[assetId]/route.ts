import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, chapters, courses } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

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
