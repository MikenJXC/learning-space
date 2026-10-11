import { env } from "cloudflare:workers";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, authLimits, sessions } from "@/db/schema";

type Account = typeof accounts.$inferSelect;
export type AccountUser = { userId: string; displayName: string; username: string; role: "owner" | "member" };
const sessionCookie = import.meta.env.DEV ? "learning_session_dev" : "__Host-learning_session";
const lifetime = 7 * 24 * 60 * 60 * 1000;
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const accountView = (account: Account): AccountUser => ({ userId: account.id, displayName: account.username, username: account.username, role: account.role });
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "请求来源无效，请在网站页面内操作" }, 403);
  }
  return null;
}
export async function authBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("请求格式无效");
  const content = await request.text();
  if (content.length > 4096) throw new Error("请求内容过长");
  const parsed: unknown = JSON.parse(content);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("请求格式无效");
  return parsed as Record<string, unknown>;
}

// Existing courses keep their owner ID. Bootstrap is configured only with runtime
// secrets, never "first registrant is admin" or a browser-supplied owner identifier.
export async function ensureOwnerAccount() {
  const config = env as unknown as { OWNER_ACCOUNT_ID?: string; OWNER_USERNAME?: string; OWNER_PASSWORD_HASH?: string };
  if (!config.OWNER_ACCOUNT_ID || !config.OWNER_USERNAME || !config.OWNER_PASSWORD_HASH) return;
  const db = getDb();
  const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, config.OWNER_ACCOUNT_ID)).limit(1);
  if (existing.length) return;
  await db.insert(accounts).values({ id: config.OWNER_ACCOUNT_ID, username: config.OWNER_USERNAME, usernameKey: config.OWNER_USERNAME.toLowerCase(), passwordHash: config.OWNER_PASSWORD_HASH, role: "owner", version: 1, createdAt: Date.now() }).onConflictDoNothing();
  const saved = await db.select({ role: accounts.role }).from(accounts).where(eq(accounts.id, config.OWNER_ACCOUNT_ID)).limit(1);
  if (saved[0]?.role !== "owner") throw new Error("管理员账号初始化失败");
}
export async function getAccountUser(): Promise<AccountUser | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await getDb().select({ account: accounts }).from(sessions)
    .innerJoin(accounts, and(eq(accounts.id, sessions.accountId), eq(accounts.version, sessions.version)))
    .where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, Date.now()))).limit(1);
  return rows[0] ? accountView(rows[0].account) : null;
}
export async function requireAccountUser() {
  const user = await getAccountUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireApiUser(request?: Request) {
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const response = checkOrigin(request);
    if (response) return { user: null, response } as const;
  }
  const user = await getAccountUser();
  if (!user) return { user: null, response: json({ error: "请先登录" }, 401) } as const;
  return { user, response: null } as const;
}
export async function startSession(account: Account) {
  const token = randomBytes(32).toString("hex");
  const db = getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
  await db.insert(sessions).values({ tokenHash: digest(token), accountId: account.id, version: account.version, expiresAt: Date.now() + lifetime });
  (await cookies()).set(sessionCookie, token, { httpOnly: true, secure: !import.meta.env.DEV, sameSite: "lax", path: "/", maxAge: lifetime / 1000 });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, digest(token)));
  jar.set(sessionCookie, "", { httpOnly: true, secure: !import.meta.env.DEV, sameSite: "lax", path: "/", maxAge: 0 });
}
export async function rateLimit(request: Request, action: string, subject: string, maximum: number, windowMs: number) {
  const ip = request.headers.get("cf-connecting-ip") || "local-preview";
  const now = Date.now();
  const key = digest(`${action}:${subject === "network" ? ip : subject}:${Math.floor(now / windowMs)}`);
  const db = getDb();
  await db.delete(authLimits).where(lt(authLimits.expiresAt, now));
  const result = await db.insert(authLimits).values({ key, count: 1, expiresAt: now + windowMs })
    .onConflictDoUpdate({ target: authLimits.key, set: { count: sql`${authLimits.count} + 1` } }).returning({ count: authLimits.count });
  if (result[0].count <= maximum) return null;
  return Response.json({ error: "尝试次数过多，请稍后再试" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.ceil(windowMs / 1000)) } });
}
