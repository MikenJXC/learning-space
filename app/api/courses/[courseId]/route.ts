import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

type Context = { params: Promise<{ courseId: string }> };

async function setDeleted(request: Request, context: Context, deleted: boolean) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const { courseId } = await context.params;
  const db = getDb();
  const owned = and(eq(courses.id, courseId), eq(courses.ownerId, auth.user.userId));
  const [course] = await db.select({ id: courses.id }).from(courses).where(owned).limit(1);
  if (!course) return Response.json({ error: "课程不存在" }, { status: 404 });
  // Keep original files and progress: deleting is reversible, never destroys course material.
  await db.update(courses).set({ deletedAt: deleted ? new Date() : null }).where(owned);
  return Response.json({ saved: true });
}

export async function DELETE(request: Request, context: Context) {
  return setDeleted(request, context, true);
}

export async function POST(request: Request, context: Context) {
  return setDeleted(request, context, false);
}
