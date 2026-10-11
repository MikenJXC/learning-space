import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "请输入课程名称" }, { status: 400 });
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(courses)
    .where(and(eq(courses.ownerId, auth.user.userId), eq(courses.name, name)))
    .limit(1);
  if (existing[0]?.deletedAt) return Response.json({ error: "已删除课程中有同名课程，请先恢复该课程" }, { status: 409 });
  if (existing[0]) return Response.json({ course: existing[0] });

  const course = {
    id: crypto.randomUUID(),
    ownerId: auth.user.userId,
    name,
    createdAt: new Date(),
  };
  await db.insert(courses).values(course);
  return Response.json({ course }, { status: 201 });
}

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const deleted = await getDb().select({ id: courses.id, name: courses.name }).from(courses)
    .where(and(eq(courses.ownerId, auth.user.userId), isNotNull(courses.deletedAt)))
    .orderBy(desc(courses.deletedAt));
  return Response.json({ courses: deleted });
}
