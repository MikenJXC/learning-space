import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts, sessions } from "@/db/schema";
import { accountView, authBody, json, rateLimit, requireApiUser, startSession } from "@/lib/auth";
import { hashPassword, usernameInfo, validatePassword, verifyPassword } from "@/lib/password";

export async function GET() {
  const auth = await requireApiUser();
  return auth.response || json({ user: auth.user });
}
export async function PATCH(request: Request) {
  const auth = await requireApiUser(request);
  if (auth.response) return auth.response;
  const limited = await rateLimit(request, "account-change", auth.user.userId, 10, 15 * 60 * 1000);
  if (limited) return limited;
  const db = getDb();
  const current = (await db.select().from(accounts).where(eq(accounts.id, auth.user.userId)).limit(1))[0];
  let body: Record<string, unknown>;
  let name: ReturnType<typeof usernameInfo> | undefined;
  try {
    body = await authBody(request);
    if (typeof body.currentPassword !== "string" || body.currentPassword.length > 512) throw new Error("请输入当前密码");
    if (body.username !== undefined) name = usernameInfo(body.username);
    if (body.password !== undefined) validatePassword(body.password);
    if (!name && !body.password) throw new Error("没有需要修改的内容");
  } catch (error) { return json({ error: error instanceof Error ? error.message : "资料无效" }, 400); }
  if (!current || !await verifyPassword(body.currentPassword as string, current.passwordHash)) return json({ error: "当前密码不正确" }, 401);
  const passwordHash = body.password ? await hashPassword(body.password as string) : current.passwordHash;
  let saved: typeof current | undefined;
  try {
    [saved] = await db.update(accounts).set({ ...(name || {}), passwordHash, version: sql`${accounts.version} + 1` })
      .where(and(eq(accounts.id, current.id), eq(accounts.version, current.version))).returning();
  } catch (error) {
    let cause: unknown = error;
    for (let i = 0; i < 5 && cause; i++) {
      if (/UNIQUE constraint failed.*username_key/i.test(String(cause))) return json({ error: "用户名已被使用，请换一个" }, 409);
      cause = cause instanceof Error ? cause.cause : null;
    }
    // Never expose a query's password-hash parameters through framework errors.
    return json({ error: "账号资料暂时无法保存，请稍后重试" }, 503);
  }
  if (!saved) return json({ error: "账号资料已更新，请重新登录" }, 409);
  await db.delete(sessions).where(eq(sessions.accountId, saved.id));
  await startSession(saved);
  return json({ user: accountView(saved), message: "已保存，其他设备的旧登录已失效" });
}
