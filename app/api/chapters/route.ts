import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, chapters, courses } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import type { AssetKind } from "@/lib/library-types";

const allowedExtensions = new Set(["pdf", "pptx", "docx"]);

function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function validateFiles(values: FormDataEntryValue[]) {
  return values.flatMap((value) => {
    if (!(value instanceof File) || value.size === 0) return [];
    if (!allowedExtensions.has(extensionOf(value.name))) {
      throw new Error(`“${value.name}”格式不受支持，仅支持 PDF、PPTX 和 DOCX`);
    }
    return [value];
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  if (!env.BUCKET) {
    return Response.json({ error: "文件存储尚未连接" }, { status: 503 });
  }

  try {
    const form = await request.formData();
    const courseId = String(form.get("courseId") ?? "").trim();
    const chapterNumber = Number(form.get("chapterNumber"));
    const slides = validateFiles(form.getAll("slides"));
    const study = validateFiles(form.getAll("study"));

    if (!courseId || !Number.isSafeInteger(chapterNumber) || chapterNumber < 0) {
      return Response.json({ error: "课程和章节信息不完整" }, { status: 400 });
    }
    if (!slides.length && !study.length && form.get("createEmptyChapter") !== "true") {
      return Response.json({ error: "请至少选择一个文件" }, { status: 400 });
    }

    const db = getDb();
    const ownedCourse = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.ownerId, auth.user.userId), isNull(courses.deletedAt)))
      .limit(1);
    if (!ownedCourse[0]) {
      return Response.json({ error: "课程不存在" }, { status: 404 });
    }

    let chapter = (
      await db
        .select()
        .from(chapters)
        .where(
          and(
            eq(chapters.courseId, courseId),
            eq(chapters.chapterNumber, chapterNumber),
          ),
        )
        .limit(1)
    )[0];

    if (!chapter) {
      chapter = {
        id: crypto.randomUUID(),
        courseId,
        chapterNumber,
        createdAt: new Date(),
      };
      await db.insert(chapters).values(chapter);
    }

    const saved = [];
    for (const [kind, files] of [
      ["slides", slides],
      ["study", study],
    ] as const satisfies readonly [AssetKind, File[]][]) {
      for (const file of files) {
        const id = crypto.randomUUID();
        const key = `${auth.user.userId}/${courseId}/${chapter.id}/${kind}/${id}-${file.name}`;
        await env.BUCKET.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
        });

        await db.insert(assets).values({
          id,
          chapterId: chapter.id,
          kind,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          r2Key: key,
          size: file.size,
          createdAt: new Date(),
        });
        saved.push({ id, kind, fileName: file.name });
      }
    }

    return Response.json({ chapter, saved }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return Response.json({ error: message }, { status: 400 });
  }
}
