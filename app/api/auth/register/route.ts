import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { accountView, authBody, checkOrigin, ensureOwnerAccount, json, rateLimit, startSession } from "@/lib/auth";
import { hashPassword, usernameInfo, validatePassword } from "@/lib/password";

export async function POST(request: Request) {
  try { return await register(request); }
  catch { return json({ error: "注册服务暂时不可用，请稍后重试" }, 503); }
}
async function register(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const throttled = await rateLimit(request, "register", "network", 10, 60 * 60 * 1000);
  if (throttled) return throttled;
  let body: Record<string, unknown>;
  let name: ReturnType<typeof usernameInfo>;
  try { body = await authBody(request); name = usernameInfo(body.username); validatePassword(body.password); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "注册信息无效" }, 400); }
  await ensureOwnerAccount();
  const account = { id: crypto.randomUUID(), ...name, passwordHash: await hashPassword(body.password as string), role: "member" as const, version: 1, createdAt: Date.now() };
  const saved = await getDb().insert(accounts).values(account).onConflictDoNothing({ target: accounts.usernameKey }).returning();
  if (!saved.length) return json({ error: "用户名已被使用，请换一个" }, 409);
  await startSession(saved[0]);
  return json({ user: accountView(saved[0]) }, 201);
}
