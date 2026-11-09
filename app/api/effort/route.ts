import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, chapters, courses, studySessions, studyTicks } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { EFFORT_MIN_SESSION_MS, effortRangeStart, validEffortTicks } from "@/lib/study-effort";

const noCache = { "Cache-Control": "private, no-store" };
function answer(data: unknown, status = 200) { return Response.json(data, { status, headers: noCache }); }

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return answer({ error: "学习记录无效" }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return answer({ error: "学习记录无效" }, 400); }
    if (!body || typeof body !== "object") return answer({ error: "学习记录无效" }, 400);
    const now = Date.now();
    const ticks = validEffortTicks(body.ticks, now);
    if (typeof body.sessionId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.sessionId) || !ticks) return answer({ error: "学习记录无效" }, 400);
    const db = getDb();
    const owned = await db.select({ id: assets.id, courseId: courses.id, courseName: courses.name, chapterNumber: chapters.chapterNumber }).from(assets)
      .innerJoin(chapters, eq(chapters.id, assets.chapterId)).innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(courses.ownerId, auth.user.userId), isNull(courses.deletedAt), inArray(assets.id, [...new Set(ticks.map(t => t.assetId))])));
    const lesson = owned[0];
    if (!lesson || ticks.some(t => !owned.some(a => a.id === t.assetId)) || owned.some(a => a.courseId !== lesson.courseId || a.chapterNumber !== lesson.chapterNumber)) return answer({ error: "文件不存在" }, 404);
    const existing = await db.select().from(studySessions).where(eq(studySessions.id, body.sessionId)).limit(1);
    if (existing[0] && (existing[0].accountId !== auth.user.userId || existing[0].courseId !== lesson.courseId || existing[0].chapterNumber !== lesson.chapterNumber)) return answer({ error: "学习记录无效" }, 400);
    // One account owns one row per wall-clock slot. Repeated requests and
    // simultaneous tabs merge by MAX rather than adding duplicate time.
    await db.batch([
      db.insert(studySessions).values({ id: body.sessionId, accountId: auth.user.userId, courseId: lesson.courseId, courseName: lesson.courseName, chapterNumber: lesson.chapterNumber, startedAt: Math.min(...ticks.map(t => t.bucketStart)) }).onConflictDoNothing(),
      ...ticks.map(tick => db.insert(studyTicks).values({ ...tick, accountId: auth.user.userId, sessionId: body.sessionId, courseId: lesson.courseId }).onConflictDoUpdate({
        target: [studyTicks.accountId, studyTicks.bucketStart],
        set: { activeMs: sql`max(${studyTicks.activeMs}, excluded.active_ms)` },
      })),
    ]);
    return answer({ saved: true });
  } catch { return answer({ error: "学习记录保存失败" }, 503); }
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  try {
    const url = new URL(request.url);
    const requestedDays = Number(url.searchParams.get("days") ?? 90);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 90;
    const offset = Number(url.searchParams.get("offset") ?? 480);
    if (!Number.isInteger(offset) || offset < -720 || offset > 840) return answer({ error: "学习记录无效" }, 400);
    const now = Date.now(), since = effortRangeStart(now, days, offset), db = getDb();
    const where = and(eq(studyTicks.accountId, auth.user.userId), gte(studyTicks.bucketStart, since));
    const shiftedSeconds = sql`(${studyTicks.bucketStart} + ${offset * 60000}) / 1000`;
    const date = sql<string>`strftime('%Y-%m-%d', ${shiftedSeconds}, 'unixepoch')`;
    const hour = sql<number>`cast(strftime('%H', ${shiftedSeconds}, 'unixepoch') as integer)`;
    const [daily, hours, courseTotals, totals, validSessions, recent] = await Promise.all([
      db.select({ date, activeMs: sql<number>`sum(${studyTicks.activeMs})` }).from(studyTicks).where(where).groupBy(date).orderBy(asc(date)),
      db.select({ hour, activeMs: sql<number>`sum(${studyTicks.activeMs})` }).from(studyTicks).where(where).groupBy(hour),
      db.select({ courseId: studyTicks.courseId, activeMs: sql<number>`sum(${studyTicks.activeMs})` }).from(studyTicks).where(where).groupBy(studyTicks.courseId),
      db.select({ lifetimeMs: sql<number>`coalesce(sum(${studyTicks.activeMs}), 0)`, firstRecordedAt: sql<number | null>`min(${studyTicks.bucketStart})` }).from(studyTicks).where(eq(studyTicks.accountId, auth.user.userId)),
      db.select({ id: studyTicks.sessionId }).from(studyTicks).where(where).groupBy(studyTicks.sessionId).having(sql`sum(${studyTicks.activeMs}) >= ${EFFORT_MIN_SESSION_MS}`),
      db.select({ id: studySessions.id, courseId: studySessions.courseId, courseName: studySessions.courseName, chapterNumber: studySessions.chapterNumber, startedAt: sql<number>`min(${studyTicks.bucketStart})`, lastAt: sql<number>`max(${studyTicks.bucketStart} + ${studyTicks.activeMs})`, activeMs: sql<number>`sum(${studyTicks.activeMs})` }).from(studyTicks)
        .innerJoin(studySessions, eq(studySessions.id, studyTicks.sessionId)).where(and(where, eq(studySessions.accountId, auth.user.userId)))
        .groupBy(studySessions.id).having(sql`sum(${studyTicks.activeMs}) >= ${EFFORT_MIN_SESSION_MS}`).orderBy(desc(sql`max(${studyTicks.bucketStart})`)).limit(12),
    ]);
    return answer({ days, offset, generatedAt: now, firstRecordedAt: totals[0]?.firstRecordedAt ?? null, lifetimeMs: totals[0]?.lifetimeMs ?? 0, activeMs: daily.reduce((sum, row) => sum + Number(row.activeMs), 0), sessions: validSessions.length, daily, hours, courses: courseTotals, recent });
  } catch { return answer({ error: "学习统计读取失败" }, 503); }
}
